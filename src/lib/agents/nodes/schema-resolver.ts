// LangGraph Node: Schema Resolver
//
// Fast resolution strategy:
// - If locked sources: only fetch tables+columns for THOSE catalogs (not all 23)
// - Uses Tier 1 (catalog list) as base, then targeted table+column fetch
// - Full Tier 2 only used when no locked sources specified

import { TIPAgentState } from '../types';
import {
  getCachedSchema,
  discoverSchemaAtTier,
  resolveTableColumns,
} from '../schema-cache';
import { buildSchemaMap, getSchemaMap, setSchemaMap } from '../../schema-mapping';
import { getRestClient } from '../../cdata-rest-client';
import { getCDataClient } from '../../cdata-client';

export async function schemaResolverNode(
  state: TIPAgentState,
): Promise<Partial<TIPAgentState>> {
  try {
    const rest = getRestClient();
    const mcp = getCDataClient();
    const lockedSources = state.lockedSources || [];

    let cache = getCachedSchema();

    if (lockedSources.length > 0) {
      // FAST PATH: only discover tables+columns for locked sources
      // Ensure we have at least Tier 1 (catalog list)
      if (!cache) {
        cache = await discoverSchemaAtTier(1, rest, mcp);
      }

      console.log(`[SchemaResolver] Resolving tables+columns for locked sources: ${lockedSources.join(', ')}`);

      // For each locked catalog, ensure we have tables
      for (const catalog of lockedSources) {
        if (!cache.schemas[catalog] || Object.keys(cache.schemas[catalog]).length === 0) {
          // Fetch tables for this specific catalog
          try {
            const tableRows = await rest.getTablesOnly(catalog);
            if (!cache.schemas[catalog]) cache.schemas[catalog] = [];
            for (const row of tableRows) {
              // Skip system schemas
              if (['auth','extensions','graphql','graphql_public','net','pgsodium','realtime','storage','supabase_functions','supabase_migrations','vault','pg_catalog','information_schema','pg_toast','cron'].includes(row.schema) || row.schema.startsWith('pg_') || row.schema.startsWith('_')) continue;
              if (!cache.schemas[catalog].includes(row.schema)) cache.schemas[catalog].push(row.schema);
              const tableKey = `${catalog}.${row.schema}`;
              if (!cache.tables[tableKey]) cache.tables[tableKey] = [];
              if (!cache.tables[tableKey].includes(row.table)) cache.tables[tableKey].push(row.table);
            }
            console.log(`[SchemaResolver] ${catalog}: ${tableRows.length} tables discovered`);
          } catch (err) {
            console.log(`[SchemaResolver] ${catalog} tables failed:`, (err as Error).message?.slice(0, 80));
          }
        }

        // Now resolve columns for each table in this catalog
        const schemas = cache.schemas[catalog] || [];
        for (const schema of schemas) {
          const tableKey = `${catalog}.${schema}`;
          const tables = cache.tables[tableKey] || [];
          // Fetch columns in parallel for speed
          await Promise.all(tables.map(async (table) => {
            const colKey = `${catalog}.${schema}.${table}`;
            if (!cache!.columns[colKey]?.length) {
              await resolveTableColumns(catalog, schema, table, rest);
            }
          }));
        }
      }

      // Refresh cache reference after lazy fetches
      cache = getCachedSchema() || cache;
    } else {
      // No locked sources — use full Tier 2 or existing schema map
      const existing = getSchemaMap();
      if (existing && Date.now() - existing.timestamp < 60 * 60 * 1000) {
        console.log(`[SchemaResolver] Using cached schema map (no locked sources)`);
        return { schemaMap: existing };
      }
      if (!cache || cache.tier < 2) {
        cache = await discoverSchemaAtTier(2, rest, mcp);
      }
    }

    // Build deterministic schema map
    const schemaMap = buildSchemaMap(cache);
    setSchemaMap(schemaMap);

    const tableCount = Object.keys(schemaMap.tables).length;
    console.log(`[SchemaResolver] Built schema map: ${tableCount} tables, sub-domain: ${schemaMap.subDomain}`);

    return { schemaMap };
  } catch (err) {
    const errorMsg = `Schema resolution failed: ${err instanceof Error ? err.message : 'Unknown error'}`;
    console.error(`[SchemaResolver] ${errorMsg}`);
    return {
      errors: [...(state.errors || []), errorMsg],
      schemaMap: state.schemaMap,
    };
  }
}
