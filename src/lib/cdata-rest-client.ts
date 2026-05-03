// CData Connect AI REST Client
// Docs: https://docs.cloud.cdata.com/en/API/REST-API-Embedded
//
// Endpoints (all relative to https://cloud.cdata.com/api):
//   POST /query                — execute SQL, returns { results: [{ schema, rows }] }
//   GET  /catalogs             — list all catalogs (connections)
//   GET  /tables               — list tables (?catalogName=&schemaName=&tableName=)
//   GET  /columns              — list columns (?catalogName=&schemaName=&tableName=)
//
// Auth: Basic (email:PAT) — Authorization: Basic base64(email:PAT)
//
// IMPORTANT: rows in /query responses are ARRAYS, not objects.
// Must zip with the schema[] array to produce key/value pairs.
// The metadata endpoints (/catalogs, /tables, /columns) return the same format.
//
// Use this client for ALL non-NL calls (schema discovery, candidates list, profile).
// Use MCP (cdata-client.ts) ONLY for LLM-generated natural language queries.

import { getConfig } from './config';
import { CachedSchema } from './agents/types';
import { gatewayCheck, recordOutcome, incrementGlobalCounter, setDedupResult, persistQuery } from './rate-limiter';

export const REST_BASE = 'https://cloud.cdata.com/api';

// ── Response helpers ──

// Converts { schema: [{COLUMN_NAME:'a',...}], rows: [[v1,v2,...]] }
// into plain objects [{ a: v1, ... }]
function zipRows(schema: any[], rows: any[][]): Record<string, any>[] {
  // CData REST uses camelCase 'columnName' in metadata endpoints (/catalogs, /tables, /columns)
  // and may use 'COLUMN_NAME' (uppercase) in query results — handle all variants
  const colNames: string[] = schema.map((c: any) =>
    c.COLUMN_NAME ?? c.column_name ?? c.columnName ?? c.name ?? ''
  );
  return rows.map((row: any[]) => {
    const obj: Record<string, any> = {};
    colNames.forEach((name, i) => { if (name) obj[name] = row[i] ?? null; });
    return obj;
  });
}

// Extracts rows from the CData REST response envelope
// Checks response-level error field per docs (HTTP 200 ≠ success)
function extractRows(data: any, description: string): Record<string, any>[] {
  if (data.error) {
    throw new Error(`[REST] ${description} error: ${JSON.stringify(data.error)}`);
  }
  const result = Array.isArray(data.results) ? data.results[0] : null;
  if (!result) return [];
  const schema: any[] = result.schema ?? [];
  const rawRows: any[][] = result.rows ?? [];
  return zipRows(schema, rawRows);
}

// ── REST Client ──

export class CDataRestClient {
  private authHeader: string;

  constructor(email?: string, pat?: string) {
    const config = getConfig();
    const e = email || config.cdata.email;
    const p = pat || config.cdata.pat;
    this.authHeader = `Basic ${Buffer.from(`${e}:${p}`).toString('base64')}`;
  }

  private async get(path: string, params?: Record<string, string>, timeoutMs = 15000): Promise<Response> {
    const url = new URL(`${REST_BASE}${path}`);
    if (params) Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      return await fetch(url.toString(), {
        headers: { Authorization: this.authHeader },
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timer);
    }
  }

  private async post(path: string, body: Record<string, any>, timeoutMs = 15000): Promise<Response> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      return await fetch(`${REST_BASE}${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: this.authHeader },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timer);
    }
  }

  // ── SQL Query ──
  // POST /query — execute any SQL statement
  // Returns rows as plain objects (rows zipped with schema)

  async query(sql: string, description?: string): Promise<{
    rows: Record<string, any>[];
    rowCount: number;
    duration: number;
  }> {
    // Deep-layer gateway check — catches any caller that bypassed route-level checks
    const gate = gatewayCheck('rest:query', sql);
    if (!gate.allowed) {
      console.log(`[Rate Limiter] REST client blocked — reason: ${gate.reason}`);
      persistQuery({ ts: Date.now(), route: 'rest:query', sql, status: 'blocked' });
      throw new Error(`Rate limited: ${gate.reason}`);
    }
    if (gate.cachedResult) {
      console.log('[Rate Limiter] REST client returning dedup cache hit');
      return gate.cachedResult;
    }

    const startTime = Date.now();
    console.log(`[REST] ${description || 'Query'}: ${sql.substring(0, 120)}`);

    try {
      const response = await this.post('/query', { query: sql });

      if (!response.ok) {
        const text = await response.text().catch(() => '');
        recordOutcome('rest:query', false);
        persistQuery({ ts: Date.now(), route: 'rest:query', sql, status: 'error' });
        throw new Error(`REST query failed (${response.status}): ${text.substring(0, 300)}`);
      }

      const data = await response.json();
      const rows = extractRows(data, description || 'query');
      const duration = Date.now() - startTime;
      console.log(`[REST] ${rows.length} rows in ${duration}ms`);

      recordOutcome('rest:query', true);
      incrementGlobalCounter();
      setDedupResult(sql, { rows, rowCount: rows.length, duration });
      persistQuery({ ts: Date.now(), route: 'rest:query', sql, status: 'success' });
      return { rows, rowCount: rows.length, duration };
    } catch (err) {
      if (!(err as Error).message?.startsWith('Rate limited')) {
        recordOutcome('rest:query', false);
        persistQuery({ ts: Date.now(), route: 'rest:query', sql, status: 'error' });
      }
      throw err;
    }
  }

  // ── Mutation Gateway (Phase 12a) ──
  // Same REST POST /query but BYPASSES dedup cache and uses stricter rate limit.
  // Records to mutation ledger for audit trail.

  async mutate(sql: string, description?: string): Promise<{
    rowsAffected: number;
    success: boolean;
    duration: number;
    error?: string;
  }> {
    // Stricter rate limit for mutations
    const gate = gatewayCheck('rest:mutation', undefined); // no SQL for dedup — mutations always execute
    if (!gate.allowed) {
      console.log(`[Rate Limiter] REST mutation blocked -- reason: ${gate.reason}`);
      persistQuery({ ts: Date.now(), route: 'rest:mutation', sql, status: 'blocked' });
      throw new Error(`Rate limited: ${gate.reason}`);
    }

    const startTime = Date.now();
    console.log(`[REST Mutation] ${description || 'Mutate'}: ${sql.substring(0, 120)}`);

    // Persist to mutation ledger
    this.appendMutationLedger({ ts: startTime, sql, description, status: 'pending' });

    try {
      const response = await this.post('/query', { query: sql });

      if (!response.ok) {
        const text = await response.text().catch(() => '');
        recordOutcome('rest:mutation', false);
        persistQuery({ ts: Date.now(), route: 'rest:mutation', sql, status: 'error' });
        this.appendMutationLedger({ ts: Date.now(), sql, description, status: 'error', error: text.substring(0, 200) });
        return { rowsAffected: 0, success: false, duration: Date.now() - startTime, error: `HTTP ${response.status}: ${text.substring(0, 200)}` };
      }

      const data = await response.json();
      if (data.error) {
        recordOutcome('rest:mutation', false);
        persistQuery({ ts: Date.now(), route: 'rest:mutation', sql, status: 'error' });
        const errMsg = JSON.stringify(data.error).substring(0, 200);
        this.appendMutationLedger({ ts: Date.now(), sql, description, status: 'error', error: errMsg });
        return { rowsAffected: 0, success: false, duration: Date.now() - startTime, error: errMsg };
      }

      const duration = Date.now() - startTime;
      const result = Array.isArray(data.results) ? data.results[0] : null;
      const rowsAffected = result?.rowsAffected ?? result?.rows?.length ?? 0;

      console.log(`[REST Mutation] ${rowsAffected} rows affected in ${duration}ms`);
      recordOutcome('rest:mutation', true);
      incrementGlobalCounter();
      persistQuery({ ts: Date.now(), route: 'rest:mutation', sql, status: 'success' });
      this.appendMutationLedger({ ts: Date.now(), sql, description, status: 'success', rowsAffected });

      return { rowsAffected, success: true, duration };
    } catch (err) {
      if (!(err as Error).message?.startsWith('Rate limited')) {
        recordOutcome('rest:mutation', false);
        persistQuery({ ts: Date.now(), route: 'rest:mutation', sql, status: 'error' });
      }
      const errMsg = err instanceof Error ? err.message : 'Unknown error';
      this.appendMutationLedger({ ts: Date.now(), sql, description, status: 'error', error: errMsg.substring(0, 200) });
      return { rowsAffected: 0, success: false, duration: Date.now() - startTime, error: errMsg };
    }
  }

  // Append to mutation-specific ledger (JSONL)
  private appendMutationLedger(entry: Record<string, any>): void {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const fs = require('fs');
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const pathMod = require('path');
      const dir = pathMod.join(process.cwd(), 'data');
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.appendFileSync(pathMod.join(dir, 'mutation-ledger.jsonl'), JSON.stringify(entry) + '\n', 'utf-8');
    } catch {
      // non-fatal
    }
  }

  // ── Tier 1: Catalogs Only (< 200ms) ──
  // Fastest possible call — just connection names for source selector + connection status

  async getCatalogsOnly(timeoutMs = 10000): Promise<string[]> {
    const gate = gatewayCheck('rest:metadata');
    if (!gate.allowed) {
      throw new Error(`Rate limited: ${gate.reason}`);
    }
    console.log('[REST] GET /catalogs (tier 1, fast)...');
    try {
      const response = await this.get('/catalogs', undefined, timeoutMs);
      if (!response.ok) {
        throw new Error(`GET /catalogs failed (${response.status})`);
      }
      const data = await response.json();
      const rows = extractRows(data, '/catalogs');
      recordOutcome('rest:metadata', true);
      incrementGlobalCounter();
      persistQuery({ ts: Date.now(), route: 'rest:metadata', status: 'success' });
      return rows.map((r) => Object.values(r)[0] as string).filter(Boolean);
    } catch (err) {
      recordOutcome('rest:metadata', false);
      persistQuery({ ts: Date.now(), route: 'rest:metadata', status: 'error' });
      throw err;
    }
  }

  // ── Tier 2: Tables Only (< 500ms) ──
  // Catalog list + table names per catalog — enough for entity types, sidebar, sub-domain detection

  async getTablesOnly(catalogName?: string, timeoutMs = 15000): Promise<{ catalog: string; schema: string; table: string }[]> {
    const gate = gatewayCheck('rest:metadata');
    if (!gate.allowed) {
      throw new Error(`Rate limited: ${gate.reason}`);
    }
    const params: Record<string, string> = {};
    if (catalogName) params.catalogName = catalogName;
    try {
      const response = await this.get('/tables', params, timeoutMs);
      if (!response.ok) {
        throw new Error(`GET /tables failed (${response.status})`);
      }
      const data = await response.json();
      const rows = extractRows(data, '/tables');
      recordOutcome('rest:metadata', true);
      incrementGlobalCounter();
      persistQuery({ ts: Date.now(), route: 'rest:metadata', status: 'success' });
      return rows.map(r => ({
        catalog: r.TABLE_CATALOG ?? '',
        schema: r.TABLE_SCHEMA ?? '',
        table: r.TABLE_NAME ?? '',
      })).filter(r => r.catalog && r.schema && r.table);
    } catch (err) {
      recordOutcome('rest:metadata', false);
      persistQuery({ ts: Date.now(), route: 'rest:metadata', status: 'error' });
      throw err;
    }
  }

  // ── Metadata: Catalogs ──
  // GET /catalogs — returns all connection/catalog names

  async getCatalogs(timeoutMs = 30000): Promise<string[]> {
    const gate = gatewayCheck('rest:metadata');
    if (!gate.allowed) {
      console.log(`[Rate Limiter] REST getCatalogs blocked — reason: ${gate.reason}`);
      persistQuery({ ts: Date.now(), route: 'rest:metadata', status: 'blocked' });
      throw new Error(`Rate limited: ${gate.reason}`);
    }
    console.log(`[REST] GET /catalogs (${timeoutMs / 1000}s timeout)...`);
    try {
      const response = await this.get('/catalogs', undefined, timeoutMs);
      if (!response.ok) {
        const text = await response.text().catch(() => '');
        recordOutcome('rest:metadata', false);
        persistQuery({ ts: Date.now(), route: 'rest:metadata', status: 'error' });
        throw new Error(`GET /catalogs failed (${response.status}): ${text.slice(0, 200)}`);
      }
      const data = await response.json();
      const rows = extractRows(data, '/catalogs');
      recordOutcome('rest:metadata', true);
      incrementGlobalCounter();
      persistQuery({ ts: Date.now(), route: 'rest:metadata', status: 'success' });
      // Each row has a single column — the catalog name
      return rows.map((r) => Object.values(r)[0] as string).filter(Boolean);
    } catch (err) {
      if (!(err as Error).message?.startsWith('Rate limited')) {
        recordOutcome('rest:metadata', false);
        persistQuery({ ts: Date.now(), route: 'rest:metadata', status: 'error' });
      }
      throw err;
    }
  }

  // ── Metadata: Tables ──
  // GET /tables — optionally filtered by catalogName / schemaName

  async getTables(catalogName?: string, schemaName?: string, timeoutMs = 15000): Promise<Record<string, any>[]> {
    const gate = gatewayCheck('rest:metadata');
    if (!gate.allowed) {
      console.log(`[Rate Limiter] REST getTables blocked — reason: ${gate.reason}`);
      persistQuery({ ts: Date.now(), route: 'rest:metadata', status: 'blocked' });
      throw new Error(`Rate limited: ${gate.reason}`);
    }
    const params: Record<string, string> = {};
    if (catalogName) params.catalogName = catalogName;
    if (schemaName) params.schemaName = schemaName;
    try {
      const response = await this.get('/tables', params, timeoutMs);
      if (!response.ok) {
        recordOutcome('rest:metadata', false);
        persistQuery({ ts: Date.now(), route: 'rest:metadata', status: 'error' });
        throw new Error(`GET /tables failed (${response.status})`);
      }
      const data = await response.json();
      recordOutcome('rest:metadata', true);
      incrementGlobalCounter();
      persistQuery({ ts: Date.now(), route: 'rest:metadata', status: 'success' });
      return extractRows(data, '/tables');
    } catch (err) {
      if (!(err as Error).message?.startsWith('Rate limited')) {
        recordOutcome('rest:metadata', false);
        persistQuery({ ts: Date.now(), route: 'rest:metadata', status: 'error' });
      }
      throw err;
    }
  }

  // ── Metadata: Columns ──
  // GET /columns — optionally filtered by catalogName / schemaName / tableName

  async getColumns(catalogName?: string, schemaName?: string, tableName?: string, timeoutMs = 15000): Promise<Record<string, any>[]> {
    const gate = gatewayCheck('rest:metadata');
    if (!gate.allowed) {
      console.log(`[Rate Limiter] REST getColumns blocked — reason: ${gate.reason}`);
      persistQuery({ ts: Date.now(), route: 'rest:metadata', status: 'blocked' });
      throw new Error(`Rate limited: ${gate.reason}`);
    }
    const params: Record<string, string> = {};
    if (catalogName) params.catalogName = catalogName;
    if (schemaName) params.schemaName = schemaName;
    if (tableName) params.tableName = tableName;
    try {
      const response = await this.get('/columns', params, timeoutMs);
      if (!response.ok) {
        recordOutcome('rest:metadata', false);
        persistQuery({ ts: Date.now(), route: 'rest:metadata', status: 'error' });
        throw new Error(`GET /columns failed (${response.status})`);
      }
      const data = await response.json();
      recordOutcome('rest:metadata', true);
      incrementGlobalCounter();
      persistQuery({ ts: Date.now(), route: 'rest:metadata', status: 'success' });
      return extractRows(data, '/columns');
    } catch (err) {
      if (!(err as Error).message?.startsWith('Rate limited')) {
        recordOutcome('rest:metadata', false);
        persistQuery({ ts: Date.now(), route: 'rest:metadata', status: 'error' });
      }
      throw err;
    }
  }

  // ── Full Schema Discovery ──
  // Strategy A: GET /catalogs → GET /columns?catalogName=X per catalog (parallel, targeted)
  // Strategy B: GET /tables → GET /columns per table in parallel (fallback)
  // Avoids GET /columns with no filter — that queries all connections and is too slow

  async discoverSchema(): Promise<CachedSchema> {
    const startTime = Date.now();
    const cache: CachedSchema = {
      catalogs: [], schemas: {}, tables: {}, columns: {},
      timestamp: Date.now(), ttlMs: 60 * 60 * 1000, tier: 3,
    };

    // Strategy A: catalog list → columns per catalog (parallel)
    console.log('[REST Schema] Strategy A: GET /catalogs...');
    try {
      const catalogs = await this.getCatalogs();
      console.log(`[REST Schema] Found ${catalogs.length} catalogs: ${catalogs.join(', ')}`);

      if (catalogs.length > 0) {
        cache.catalogs = catalogs;

        // Fetch columns for each catalog in parallel (each call is filtered = fast)
        await Promise.all(catalogs.map(async (catalog) => {
          try {
            const rows = await this.getColumns(catalog, undefined, undefined, 30000);
            for (const row of rows) {
              const schema: string = row.TABLE_SCHEMA ?? '';
              const table: string = row.TABLE_NAME ?? '';
              const column: string = row.COLUMN_NAME ?? '';
              const dataType: string = row.TYPE_NAME ?? String(row.DATA_TYPE ?? 'varchar');
              if (!schema || !table || !column) continue;
              // Skip system schemas (PostgreSQL/Supabase internal)
              const SYSTEM_SCHEMAS = ['auth','extensions','graphql','graphql_public','net','pgsodium','pgsodium_masks','pgbouncer','realtime','storage','supabase_functions','supabase_migrations','vault','pg_catalog','information_schema','pg_toast','cron'];
              if (SYSTEM_SCHEMAS.includes(schema) || schema.startsWith('pg_') || schema.startsWith('_')) continue;

              if (!cache.schemas[catalog]) cache.schemas[catalog] = [];
              if (!cache.schemas[catalog].includes(schema)) cache.schemas[catalog].push(schema);
              const tableKey = `${catalog}.${schema}`;
              if (!cache.tables[tableKey]) cache.tables[tableKey] = [];
              if (!cache.tables[tableKey].includes(table)) cache.tables[tableKey].push(table);
              const colKey = `${catalog}.${schema}.${table}`;
              if (!cache.columns[colKey]) cache.columns[colKey] = [];
              cache.columns[colKey].push({ name: column, type: dataType });
            }
            console.log(`[REST Schema] ${catalog}: ${rows.length} column rows`);
          } catch (err) {
            console.log(`[REST Schema] columns for ${catalog} failed:`, (err as Error).message?.slice(0, 100));
          }
        }));

        if (Object.values(cache.tables).flat().length > 0) {
          const tc = Object.values(cache.tables).flat().length;
          console.log(`[REST Schema] Strategy A OK — ${cache.catalogs.length} catalogs, ${tc} tables in ${Date.now() - startTime}ms`);
          return cache;
        }
      }
    } catch (err) {
      console.log('[REST Schema] Strategy A failed:', (err as Error).message?.slice(0, 200));
    }

    // Strategy B: GET /tables (no catalog filter) then columns per table
    console.log('[REST Schema] Strategy B: GET /tables...');
    try {
      const tables = await this.getTables(undefined, undefined, 30000);
      if (tables.length > 0) {
        for (const row of tables) {
          const catalog = row.TABLE_CATALOG ?? '';
          const schema = row.TABLE_SCHEMA ?? '';
          const table = row.TABLE_NAME ?? '';
          if (!catalog || !schema || !table) continue;
          if (!cache.catalogs.includes(catalog)) cache.catalogs.push(catalog);
          if (!cache.schemas[catalog]) cache.schemas[catalog] = [];
          if (!cache.schemas[catalog].includes(schema)) cache.schemas[catalog].push(schema);
          const tableKey = `${catalog}.${schema}`;
          if (!cache.tables[tableKey]) cache.tables[tableKey] = [];
          if (!cache.tables[tableKey].includes(table)) cache.tables[tableKey].push(table);
        }

        const allTableEntries = tables.map((r) => ({
          catalog: r.TABLE_CATALOG ?? '',
          schema: r.TABLE_SCHEMA ?? '',
          table: r.TABLE_NAME ?? '',
        })).filter(t => t.catalog && t.schema && t.table);

        const batchSize = 5;
        for (let i = 0; i < allTableEntries.length; i += batchSize) {
          await Promise.all(allTableEntries.slice(i, i + batchSize).map(async ({ catalog, schema, table }) => {
            try {
              const cols = await this.getColumns(catalog, schema, table, 15000);
              cache.columns[`${catalog}.${schema}.${table}`] = cols.map(c => ({
                name: c.COLUMN_NAME ?? '',
                type: c.TYPE_NAME ?? String(c.DATA_TYPE ?? 'varchar'),
              }));
            } catch { /* non-fatal */ }
          }));
        }

        const tc = Object.values(cache.tables).flat().length;
        console.log(`[REST Schema] Strategy B OK — ${cache.catalogs.length} catalogs, ${tc} tables in ${Date.now() - startTime}ms`);
        return cache;
      }
    } catch (err) {
      console.log('[REST Schema] Strategy B failed:', (err as Error).message?.slice(0, 120));
    }

    console.error('[REST Schema] Both REST strategies failed — returning empty cache');
    return cache;
  }

  // ── Private: build CachedSchema from /columns rows ──

  private buildCacheFromRows(cache: CachedSchema, rows: Record<string, any>[]): void {
    for (const row of rows) {
      const catalog: string = row.TABLE_CATALOG ?? '';
      const schema: string = row.TABLE_SCHEMA ?? '';
      const table: string = row.TABLE_NAME ?? '';
      const column: string = row.COLUMN_NAME ?? '';
      const dataType: string = row.TYPE_NAME ?? String(row.DATA_TYPE ?? 'varchar');

      if (!catalog || !schema || !table || !column) continue;

      if (!cache.catalogs.includes(catalog)) cache.catalogs.push(catalog);
      if (!cache.schemas[catalog]) cache.schemas[catalog] = [];
      if (!cache.schemas[catalog].includes(schema)) cache.schemas[catalog].push(schema);
      const tableKey = `${catalog}.${schema}`;
      if (!cache.tables[tableKey]) cache.tables[tableKey] = [];
      if (!cache.tables[tableKey].includes(table)) cache.tables[tableKey].push(table);
      const colKey = `${catalog}.${schema}.${table}`;
      if (!cache.columns[colKey]) cache.columns[colKey] = [];
      cache.columns[colKey].push({ name: column, type: dataType });
    }
  }
}

// ── Singleton ──

let restClient: CDataRestClient | null = null;

export function getRestClient(email?: string, pat?: string): CDataRestClient {
  if (!restClient || email || pat) {
    restClient = new CDataRestClient(email, pat);
  }
  return restClient;
}

export function resetRestClient(): void {
  restClient = null;
}
