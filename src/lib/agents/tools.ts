// LangGraph Tool Definitions
// These wrap existing REST/MCP operations for use by ReAct nodes (future phases)
// For now they're available as standalone functions and future LangGraph tools

import { getRestClient } from '../cdata-rest-client';
import { getCDataClient } from '../cdata-client';
import { getOrDiscoverSchema, findTable } from './schema-cache';
import { CachedSchema } from './types';

// ── Discover Schema Tool ──
// Discovers schema for a catalog or all catalogs
export async function discoverSchema(catalog?: string): Promise<CachedSchema> {
  const rest = getRestClient();
  const mcp = getCDataClient();
  return getOrDiscoverSchema(mcp, rest);
}

// ── Query Data Tool ──
// Execute SQL query via Connect AI REST API
export async function queryData(sql: string): Promise<{
  rows: Record<string, any>[];
  rowCount: number;
  duration: number;
}> {
  const rest = getRestClient();
  return rest.query(sql, 'LangGraph tool');
}

// ── Find Table Tool ──
// Find a table by keyword, optionally preferring a specific catalog
export async function findTableByKeyword(
  keyword: string,
  preferCatalog?: string,
): Promise<string | null> {
  const rest = getRestClient();
  const mcp = getCDataClient();
  const cache = await getOrDiscoverSchema(mcp, rest);
  return findTable(cache, keyword, preferCatalog);
}

// ── Get Catalogs Tool ──
// List all available catalogs (connections)
export async function getCatalogs(): Promise<string[]> {
  const rest = getRestClient();
  return rest.getCatalogs();
}

// ── Get Table Columns Tool ──
// Get columns for a specific table
export async function getTableColumns(
  catalogName: string,
  schemaName?: string,
  tableName?: string,
): Promise<Record<string, any>[]> {
  const rest = getRestClient();
  return rest.getColumns(catalogName, schemaName, tableName);
}
