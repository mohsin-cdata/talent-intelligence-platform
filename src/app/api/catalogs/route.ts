import { NextRequest, NextResponse } from 'next/server';
import { CDataRestClient } from '@/lib/cdata-rest-client';
import { getCDataClient, CDataClient } from '@/lib/cdata-client';
import { getConfig } from '@/lib/config';
import { getOrDiscoverSchema, clearSchemaCache, discoverSchemaAtTier, upgradeTierInBackground, getCachedSchema } from '@/lib/agents/schema-cache';
import { getSchemaMap } from '@/lib/schema-mapping';
import { gatewayCheck, recordOutcome, incrementGlobalCounter, persistQuery } from '@/lib/rate-limiter';

// In-memory cache (REST is faster so we can afford shorter TTL)
let catalogCache: any = null;
let catalogCacheTime = 0;
const CATALOG_CACHE_TTL = 60 * 60 * 1000; // 1 hour

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const refresh = searchParams.get('refresh') === 'true';
    const now = Date.now();

    if (!refresh && catalogCache && now - catalogCacheTime < CATALOG_CACHE_TTL) {
      return NextResponse.json({ ...catalogCache, cached: true });
    }

    const config = getConfig();
    const headerEmail = request.headers.get('x-cdata-email');
    const headerPAT = request.headers.get('x-cdata-pat');

    const email = headerEmail || config.cdata.email;
    const pat = headerPAT || config.cdata.pat;

    if (!email || !pat) {
      return NextResponse.json({ error: 'CData not configured' }, { status: 400 });
    }

    if (refresh) clearSchemaCache();

    // Gate before hitting CData
    const gate = gatewayCheck('/api/catalogs');
    if (!gate.allowed) {
      return NextResponse.json({ error: 'Rate limited', rateLimited: true, reason: gate.reason }, { status: 429 });
    }

    // Discover schema via REST (single INFORMATION_SCHEMA query)
    // Falls back to MCP if REST fails
    const rest = new CDataRestClient(email, pat);
    const mcp: CDataClient = (headerEmail && headerPAT)
      ? new CDataClient(headerEmail, headerPAT)
      : getCDataClient();

    console.log('[Catalogs API] Discovering schema via REST...');
    // Use Tier 2 (catalogs + tables, no columns) — fast enough for source selector
    // Tier 3 (columns for all 23 catalogs) is too slow and only needed at query time
    let schema = getCachedSchema();
    if (!schema || schema.tier < 2) {
      schema = await discoverSchemaAtTier(2, rest, mcp);
    }

    // Format into catalog tree for the UI
    const catalogDetails = schema.catalogs.map(catalog => {
      const schemas = schema.schemas[catalog] || [];
      const schemasWithTables = schemas.map(schemaName => {
        const tableKey = `${catalog}.${schemaName}`;
        const tables = (schema.tables[tableKey] || []).map(name => ({
          name,
          displayName: name.replace(/^[ _]+/, '').replace(/_/g, ' '),
        }));
        return { schema: schemaName, tables };
      });
      return {
        catalog,
        schemas: schemasWithTables,
        tableCount: schemasWithTables.reduce((sum, s) => sum + s.tables.length, 0),
      };
    });

    // Include schema map summary if available
    const schemaMap = getSchemaMap();
    const schemaMapSummary = schemaMap ? {
      subDomain: schemaMap.subDomain,
      tableCount: Object.keys(schemaMap.tables).length,
      entityTypes: [...new Set(Object.values(schemaMap.tables).map(t => t.entityType))],
      timestamp: schemaMap.timestamp,
    } : null;

    const result = {
      catalogs: catalogDetails,
      totalCatalogs: catalogDetails.length,
      totalTables: catalogDetails.reduce((sum, c) => sum + c.tableCount, 0),
      schemaMapSummary,
    };

    catalogCache = result;
    catalogCacheTime = now;

    recordOutcome('/api/catalogs', true);
    incrementGlobalCounter();
    persistQuery({ ts: Date.now(), route: '/api/catalogs', status: 'success' });
    return NextResponse.json({ ...result, cached: false });
  } catch (error) {
    recordOutcome('/api/catalogs', false);
    persistQuery({ ts: Date.now(), route: '/api/catalogs', status: 'error' });
    console.error('[Catalogs API] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to discover catalogs' },
      { status: 500 }
    );
  }
}
