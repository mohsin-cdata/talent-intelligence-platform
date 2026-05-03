// Schema Cache - Progressive tiered discovery + caching
//
// Tier 1: GET /catalogs              (< 200ms) — source selector, connection status
// Tier 2: GET /tables per catalog    (< 500ms) — entity types, sidebar, sub-domain detection
// Tier 3: GET /columns per table     (< 1-2s)  — full roles, NL-to-SQL, profile pages
//          Lazy: resolve columns for queried table first, backfill rest in background
//
// TTL: 1 hour for all tiers

import { CDataClient } from '@/lib/cdata-client';
import { CDataRestClient } from '@/lib/cdata-rest-client';
import { CachedSchema, SchemaTier } from './types';
import { buildSchemaMap, setSchemaMap } from '../schema-mapping';
import type { SchemaMap, EntityType } from './types';

const SCHEMA_TTL_MS = 60 * 60 * 1000; // 1 hour

// System schemas to exclude (PostgreSQL/Supabase internal schemas)
const SYSTEM_SCHEMAS = new Set([
  'auth', 'extensions', 'graphql', 'graphql_public', 'net', 'pgsodium',
  'pgsodium_masks', 'pgbouncer', 'realtime', 'storage', 'supabase_functions',
  'supabase_migrations', 'vault', 'pg_catalog', 'information_schema',
  'pg_toast', 'pg_temp_1', 'pg_toast_temp_1', 'cron',
]);

function isSystemSchema(schema: string): boolean {
  return SYSTEM_SCHEMAS.has(schema) || schema.startsWith('pg_') || schema.startsWith('_');
}

let schemaCache: CachedSchema | null = null;

// ── Cache accessors ──

export function isSchemaValid(): boolean {
  if (!schemaCache) return false;
  return Date.now() - schemaCache.timestamp < schemaCache.ttlMs;
}

export function getCachedSchema(): CachedSchema | null {
  if (isSchemaValid()) return schemaCache;
  return null;
}

export function getSchemaTier(): SchemaTier | null {
  if (!isSchemaValid()) return null;
  return schemaCache!.tier;
}

export function clearSchemaCache(): void {
  schemaCache = null;
  console.log('[Schema Cache] Cleared');
}

// ── Schema prompt builder (Phase 11b: schema-aware, much smaller prompts) ──

export interface SchemaPromptOptions {
  lockedSources?: string[];       // Only include these catalogs
  relevantEntities?: EntityType[]; // Only include tables of these entity types
  maxTables?: number;              // Cap tables in prompt (default: 30)
  lockedTables?: string[];         // Legacy: table name filter
}

export function buildSchemaPrompt(cache: CachedSchema, opts?: SchemaPromptOptions | string[]): string {
  // Backwards compat: if opts is string[], treat as lockedTables
  const options: SchemaPromptOptions = Array.isArray(opts) ? { lockedTables: opts } : (opts || {});
  const { lockedSources, relevantEntities, maxTables = 30, lockedTables } = options;

  // Get schema map for entity type filtering
  let schemaMap: SchemaMap | null = null;
  try {
    const { getSchemaMap } = require('../schema-mapping');
    schemaMap = getSchemaMap();
  } catch { /* non-fatal */ }

  let prompt = 'Available data sources (live from CData Connect AI):\n';
  let tableCount = 0;

  for (const catalog of cache.catalogs) {
    // Filter by locked sources
    if (lockedSources && lockedSources.length > 0 && !lockedSources.includes(catalog)) continue;

    const schemas = cache.schemas[catalog] || [];
    for (const schema of schemas) {
      const tableKey = `${catalog}.${schema}`;
      const tables = cache.tables[tableKey] || [];

      // Apply table name filter (legacy lockedTables)
      let filteredTables = lockedTables && lockedTables.length > 0
        ? tables.filter(t => lockedTables.some(lt =>
            t.toLowerCase().includes(lt.toLowerCase()) ||
            lt.toLowerCase().includes(t.toLowerCase())
          ))
        : tables;

      // Apply entity type filter via schema map
      if (relevantEntities && relevantEntities.length > 0 && schemaMap) {
        filteredTables = filteredTables.filter(t => {
          const fqn = `${catalog}.${schema}.${t}`;
          const tableMap = schemaMap!.tables[fqn];
          return tableMap ? relevantEntities.includes(tableMap.entityType) : true; // keep unmapped tables
        });
      }

      if (filteredTables.length === 0) continue;

      prompt += `\nCatalog: ${catalog}, Schema: ${schema}\n`;

      for (const table of filteredTables) {
        if (tableCount >= maxTables) break;

        const colKey = `${catalog}.${schema}.${table}`;
        const columns = cache.columns[colKey] || [];

        if (columns.length > 0) {
          // Schema-aware: only include mapped roles to shrink prompt
          let colList: string;
          if (schemaMap) {
            const fqn = `${catalog}.${schema}.${table}`;
            const tableMap = schemaMap.tables[fqn];
            if (tableMap) {
              // Include mapped columns (by role) + first few unmapped
              const mappedNames = new Set(tableMap.columns.map(c => c.columnName));
              const mapped = columns.filter(c => mappedNames.has(c.name));
              const unmapped = columns.filter(c => !mappedNames.has(c.name)).slice(0, 3);
              const selected = [...mapped, ...unmapped];
              colList = selected.map(c => `${c.name}(${c.type})`).join(', ');
              if (unmapped.length < columns.length - mapped.length) {
                colList += ` (+${columns.length - mapped.length - unmapped.length} more)`;
              }
            } else {
              colList = columns.map(c => `${c.name}(${c.type})`).join(', ');
            }
          } else {
            colList = columns.map(c => `${c.name}(${c.type})`).join(', ');
          }
          prompt += `  [${catalog}].[${schema}].[${table}]: ${colList}\n`;
        } else {
          // Tier 1-2: no columns yet, just table name
          prompt += `  [${catalog}].[${schema}].[${table}]\n`;
        }
        tableCount++;
      }
      if (tableCount >= maxTables) break;
    }
    if (tableCount >= maxTables) break;
  }

  if (tableCount >= maxTables) {
    prompt += `\n(Showing ${maxTables} of ${Object.values(cache.tables).flat().length} tables)\n`;
  }

  prompt += '\nSQL Rules:\n';
  prompt += '- Use fully qualified names: [Catalog].[Schema].[Table]\n';
  prompt += '- Bracket column names: [ColumnName]\n';
  prompt += '- Single-quote strings — CASE SENSITIVE (use Title Case: \'Active\' not \'active\')\n';
  prompt += '- Common status values: Active, Placed, Inactive, DNC, Archived, Open, Filled, Closed, On Hold, Completed, Terminated, Pending\n';
  prompt += '- Common activity types: Note, Call, Email, Interview, Submission, Offer\n';
  prompt += '- Add LIMIT 50 unless user specifies otherwise\n';
  prompt += '- Table names may have leading spaces -- copy them exactly as shown above\n';

  return prompt;
}

// ── Build CachedSchema from INFORMATION_SCHEMA.COLUMNS rows ──

function buildCacheFromRows(rows: any[]): CachedSchema {
  const cache: CachedSchema = {
    catalogs: [], schemas: {}, tables: {}, columns: {},
    timestamp: Date.now(), ttlMs: SCHEMA_TTL_MS, tier: 3,
  };
  for (const row of rows) {
    const catalog: string = row.TABLE_CATALOG || row.table_catalog || '';
    const schema: string = row.TABLE_SCHEMA || row.table_schema || '';
    const table: string = row.TABLE_NAME || row.table_name || '';
    const column: string = row.COLUMN_NAME || row.column_name || '';
    const dataType: string = row.DATA_TYPE || row.data_type || 'varchar';
    if (!catalog || !schema || !table || !column) continue;
    if (isSystemSchema(schema)) continue;

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
  return cache;
}

// ── Tiered Discovery ──

// Tier 1: Catalogs only (< 200ms)
async function discoverTier1(rest: CDataRestClient): Promise<CachedSchema> {
  console.log('[Schema Cache] Tier 1: catalogs only...');
  const catalogs = await rest.getCatalogsOnly();
  console.log(`[Schema Cache] Tier 1 OK: ${catalogs.length} catalogs`);
  return {
    catalogs,
    schemas: {},
    tables: {},
    columns: {},
    timestamp: Date.now(),
    ttlMs: SCHEMA_TTL_MS,
    tier: 1,
  };
}

// Tier 2: Catalogs + tables (< 500ms)
async function discoverTier2(rest: CDataRestClient, existing?: CachedSchema): Promise<CachedSchema> {
  console.log('[Schema Cache] Tier 2: catalogs + tables...');
  const cache: CachedSchema = {
    catalogs: existing?.catalogs || [],
    schemas: {},
    tables: {},
    columns: existing?.columns || {}, // preserve any columns from prior tier 3
    timestamp: Date.now(),
    ttlMs: SCHEMA_TTL_MS,
    tier: 2,
  };

  // Get catalogs if not already known
  if (cache.catalogs.length === 0) {
    cache.catalogs = await rest.getCatalogsOnly();
  }

  // Fetch tables for each catalog in parallel
  await Promise.all(cache.catalogs.map(async (catalog) => {
    try {
      const tableRows = await rest.getTablesOnly(catalog);
      let filtered = 0;
      for (const row of tableRows) {
        // Skip system schemas (PostgreSQL/Supabase internal)
        if (isSystemSchema(row.schema)) { filtered++; continue; }
        if (!cache.schemas[catalog]) cache.schemas[catalog] = [];
        if (!cache.schemas[catalog].includes(row.schema)) cache.schemas[catalog].push(row.schema);
        const tableKey = `${catalog}.${row.schema}`;
        if (!cache.tables[tableKey]) cache.tables[tableKey] = [];
        if (!cache.tables[tableKey].includes(row.table)) cache.tables[tableKey].push(row.table);
      }
      const kept = tableRows.length - filtered;
      console.log(`[Schema Cache] Tier 2: ${catalog} -> ${kept} tables${filtered ? ` (${filtered} system filtered)` : ''}`);
    } catch (err) {
      console.log(`[Schema Cache] Tier 2: ${catalog} tables failed:`, (err as Error).message?.slice(0, 80));
    }
  }));

  console.log(`[Schema Cache] Tier 2 OK: ${cache.catalogs.length} catalogs, ${Object.values(cache.tables).flat().length} tables`);
  return cache;
}

// Tier 3: Full columns (existing discoverSchema path)
// Reuses the REST client's discoverSchema() which already does catalogs -> columns
async function discoverTier3(rest: CDataRestClient, mcp?: CDataClient, existing?: CachedSchema): Promise<CachedSchema> {
  console.log('[Schema Cache] Tier 3: full column discovery...');
  const startTime = Date.now();

  // Try REST first
  try {
    const cache = await rest.discoverSchema();
    if (cache.catalogs.length > 0) {
      cache.tier = 3;
      console.log(`[Schema Cache] Tier 3 REST OK in ${Date.now() - startTime}ms`);
      return cache;
    }
  } catch (err) {
    console.log('[Schema Cache] Tier 3 REST failed:', (err as Error).message?.slice(0, 120));
  }

  // MCP fallback
  if (mcp) {
    console.log('[Schema Cache] Tier 3 MCP fallback: INFORMATION_SCHEMA.COLUMNS');
    try {
      const IS_SQL = [
        'SELECT TABLE_CATALOG, TABLE_SCHEMA, TABLE_NAME, COLUMN_NAME, DATA_TYPE',
        'FROM INFORMATION_SCHEMA.COLUMNS',
        'ORDER BY TABLE_CATALOG, TABLE_SCHEMA, TABLE_NAME, ORDINAL_POSITION',
      ].join(' ');
      const { rows } = await mcp.queryData(IS_SQL, 'Schema discovery');
      if (rows.length > 0) {
        const cache = buildCacheFromRows(rows);
        cache.tier = 3;
        console.log(`[Schema Cache] Tier 3 MCP OK in ${Date.now() - startTime}ms`);
        return cache;
      }
    } catch (err) {
      console.log('[Schema Cache] Tier 3 MCP failed:', (err as Error).message?.slice(0, 120));
    }
  }

  // If we have an existing tier 2 cache, return it rather than empty
  if (existing && existing.catalogs.length > 0) {
    console.log('[Schema Cache] Tier 3 failed, keeping existing tier', existing.tier);
    return existing;
  }

  console.error('[Schema Cache] All tier 3 strategies failed -- returning empty cache');
  return {
    catalogs: [], schemas: {}, tables: {}, columns: {},
    timestamp: Date.now(), ttlMs: SCHEMA_TTL_MS, tier: 3,
  };
}

// Resolve columns for a specific table (lazy tier 3 for a single table)
export async function resolveTableColumns(
  catalog: string,
  schema: string,
  table: string,
  rest?: CDataRestClient,
): Promise<{ name: string; type: string }[]> {
  const colKey = `${catalog}.${schema}.${table}`;

  // Already cached?
  if (schemaCache?.columns[colKey]?.length) {
    return schemaCache.columns[colKey];
  }

  // Lazy fetch
  if (!rest) {
    const { getRestClient } = await import('@/lib/cdata-rest-client');
    rest = getRestClient();
  }

  try {
    const rows = await rest.getColumns(catalog, schema, table, 15000);
    const cols = rows.map(c => ({
      name: c.COLUMN_NAME ?? '',
      type: c.TYPE_NAME ?? String(c.DATA_TYPE ?? 'varchar'),
    })).filter(c => c.name);

    // Update cache in-place
    if (schemaCache) {
      schemaCache.columns[colKey] = cols;
    }

    return cols;
  } catch (err) {
    console.log(`[Schema Cache] Lazy column fetch failed for ${colKey}:`, (err as Error).message?.slice(0, 80));
    return [];
  }
}

// ── Build schema map + cache it (non-fatal) ──

function buildAndCacheSchemaMap(cache: CachedSchema): void {
  try {
    const map = buildSchemaMap(cache);
    setSchemaMap(map);
    console.log(`[Schema Cache] Schema map built: ${Object.keys(map.tables).length} tables, sub-domain: ${map.subDomain}`);
  } catch (mapErr) {
    console.log('[Schema Cache] Schema map build failed (non-fatal):', (mapErr as Error).message?.slice(0, 100));
  }
}

// ── Progressive discovery: discover at requested tier ──

export async function discoverSchemaAtTier(
  tier: SchemaTier,
  rest?: CDataRestClient,
  mcp?: CDataClient,
): Promise<CachedSchema> {
  if (!rest) {
    const { getRestClient } = await import('@/lib/cdata-rest-client');
    rest = getRestClient();
  }

  let cache: CachedSchema;
  switch (tier) {
    case 1:
      cache = await discoverTier1(rest);
      break;
    case 2:
      cache = await discoverTier2(rest, schemaCache || undefined);
      break;
    case 3:
      cache = await discoverTier3(rest, mcp || undefined, schemaCache || undefined);
      break;
  }

  schemaCache = cache;
  if (tier >= 2) buildAndCacheSchemaMap(cache);
  return cache;
}

// ── Upgrade tier in background ──

let upgradeInProgress = false;

export async function upgradeTierInBackground(
  targetTier: SchemaTier,
  rest?: CDataRestClient,
  mcp?: CDataClient,
): Promise<void> {
  const currentTier = schemaCache?.tier || 0;
  if (currentTier >= targetTier || upgradeInProgress) return;

  upgradeInProgress = true;
  try {
    console.log(`[Schema Cache] Background upgrade: tier ${currentTier} -> ${targetTier}`);
    await discoverSchemaAtTier(targetTier, rest, mcp);
  } finally {
    upgradeInProgress = false;
  }
}

// ── Legacy entry points (backwards compatible) ──

export async function discoverSchema(
  mcp: CDataClient,
  rest?: CDataRestClient,
): Promise<CachedSchema> {
  // Full tier 3 discovery (original behavior)
  return discoverSchemaAtTier(3, rest, mcp);
}

// Find a fully-qualified table name by keyword match (case-insensitive)
// preferCatalog: search this catalog first before iterating others
export function findTable(cache: CachedSchema, keyword: string, preferCatalog?: string): string | null {
  const kw = keyword.toLowerCase().replace(/\s/g, '');

  // Search preferred catalog first if specified
  if (preferCatalog) {
    const schemas = cache.schemas[preferCatalog] || [];
    for (const schema of schemas) {
      const tables = cache.tables[`${preferCatalog}.${schema}`] || [];
      const match = tables.find(t => t.toLowerCase().replace(/\s/g, '').includes(kw));
      if (match) return `[${preferCatalog}].[${schema}].[${match}]`;
    }
  }

  // Fall back to all catalogs
  for (const catalog of cache.catalogs) {
    if (catalog === preferCatalog) continue;
    const schemas = cache.schemas[catalog] || [];
    for (const schema of schemas) {
      const tableKey = `${catalog}.${schema}`;
      const tables = cache.tables[tableKey] || [];
      const match = tables.find(t => t.toLowerCase().replace(/\s/g, '').includes(kw));
      if (match) return `[${catalog}].[${schema}].[${match}]`;
    }
  }
  return null;
}

// Get schema from cache or discover fresh (full tier 3)
export async function getOrDiscoverSchema(
  cdata: CDataClient,
  rest?: CDataRestClient,
): Promise<CachedSchema> {
  const cached = getCachedSchema();
  if (cached) {
    console.log(`[Schema Cache] Cache hit (tier ${cached.tier})`);
    return cached;
  }

  return discoverSchema(cdata, rest);
}
