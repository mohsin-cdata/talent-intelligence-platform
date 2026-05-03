// Dynamic candidate profile -- REST only, no MCP
// Discovers candidates/placements/activities tables from schema cache
// Resolves actual column names dynamically (handles snake_case, PascalCase, etc.)
// Runs all three queries in parallel via REST POST /query

import { NextRequest, NextResponse } from 'next/server';
import { findTable, getCachedSchema, discoverSchemaAtTier, resolveTableColumns } from '@/lib/agents/schema-cache';
import { CDataRestClient } from '@/lib/cdata-rest-client';
import { getConfig } from '@/lib/config';
import { resolveColumnName } from '@/lib/field-resolver';
import { persistQuery } from '@/lib/rate-limiter';

// Parse [Catalog].[Schema].[Table] into parts
function parseFqn(fqn: string): { catalog: string; schema: string; table: string } | null {
  const match = fqn.match(/^\[([^\]]+)\]\.\[([^\]]+)\]\.\[([^\]]+)\]$/);
  if (!match) return null;
  return { catalog: match[1], schema: match[2], table: match[3] };
}

// Get actual column names for a table from the schema cache
function getTableColumns(cache: any, fqn: string): string[] {
  const parts = parseFqn(fqn);
  if (!parts) return [];
  const colKey = `${parts.catalog}.${parts.schema}.${parts.table}`;
  const cols = cache.columns[colKey];
  if (!cols) return [];
  return cols.map((c: any) => c.name);
}

// Lazy-resolve columns if not in cache (non-fatal: returns [] on failure)
async function ensureColumns(fqn: string, cache: any, rest: CDataRestClient): Promise<string[]> {
  const cached = getTableColumns(cache, fqn);
  if (cached.length > 0) return cached;
  const parts = parseFqn(fqn);
  if (!parts) return [];
  try {
    const cols = await resolveTableColumns(parts.catalog, parts.schema, parts.table, rest);
    return cols.map(c => c.name);
  } catch {
    return [];
  }
}

// Resolve a column name for SQL bracket notation.
// If column list is available, do proper resolution.
// If column list is empty (rate limited/failed), use fallback common names.
function resolveCol(canonical: string, columns: string[]): string {
  if (columns.length > 0) {
    const actual = resolveColumnName(canonical, columns);
    if (actual) return `[${actual}]`;
  }
  // Fallback: try both snake_case and PascalCase variants
  const FALLBACKS: Record<string, string[]> = {
    candidateId: ['candidate_id', 'CandidateId'],
    startDate: ['start_date', 'StartDate'],
    endDate: ['end_date', 'EndDate'],
    activityDate: ['activity_date', 'ActivityDate'],
    lastName: ['last_name', 'LastName'],
    firstName: ['first_name', 'FirstName'],
  };
  const fb = FALLBACKS[canonical];
  // Default to snake_case first (most common for PostgreSQL), then PascalCase
  return fb ? `[${fb[0]}]` : `[${canonical}]`;
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const config = getConfig();
    const headerEmail = request.headers.get('x-cdata-email');
    const headerPAT = request.headers.get('x-cdata-pat');
    const email = headerEmail || config.cdata.email;
    const pat = headerPAT || config.cdata.pat;
    const candidateId = decodeURIComponent(params.id);

    if (!email || !pat) {
      return NextResponse.json({ error: 'CData not configured' }, { status: 400 });
    }

    const rest = new CDataRestClient(email, pat);

    // Use cached schema if available (avoids extra REST calls on profile load)
    let schema = getCachedSchema();
    if (!schema) {
      schema = await discoverSchemaAtTier(2, rest);
    }

    // Find candidates table first to derive the preferred catalog
    const candidatesTable = findTable(schema, 'candidate');
    const preferCatalog = candidatesTable
      ? candidatesTable.match(/^\[([^\]]+)\]/)?.[1]
      : undefined;

    // Search placements/activities in the same catalog as candidates
    const placementsTable = findTable(schema, 'placement', preferCatalog);
    const activitiesTable = findTable(schema, 'activit', preferCatalog);

    // Resolve actual column names (lazy-fetch if not cached, fallback if rate limited)
    const [candCols, placCols, actCols] = await Promise.all([
      candidatesTable ? ensureColumns(candidatesTable, schema, rest) : Promise.resolve([]),
      placementsTable ? ensureColumns(placementsTable, schema, rest) : Promise.resolve([]),
      activitiesTable ? ensureColumns(activitiesTable, schema, rest) : Promise.resolve([]),
    ]);

    // No route-level gateway check here -- REST client has its own rest:query rate limiter
    // Adding a second gate caused cascade blocking from React StrictMode double-renders

    // Build SQL with resolved column names (resolveCol has fallbacks if cols are empty)
    // Use unquoted value for numeric IDs (PostgreSQL integer columns reject string comparison)
    const idValue = /^\d+$/.test(candidateId) ? candidateId : `'${candidateId}'`;

    const candidateSql = candidatesTable
      ? `SELECT * FROM ${candidatesTable} WHERE ${resolveCol('candidateId', candCols)} = ${idValue}`
      : null;

    const placementsSql = placementsTable
      ? `SELECT * FROM ${placementsTable} WHERE ${resolveCol('candidateId', placCols)} = ${idValue} ORDER BY ${resolveCol('startDate', placCols)} DESC LIMIT 50`
      : null;

    const activitiesSql = activitiesTable
      ? `SELECT * FROM ${activitiesTable} WHERE ${resolveCol('candidateId', actCols)} = ${idValue} ORDER BY ${resolveCol('activityDate', actCols)} DESC LIMIT 50`
      : null;

    console.log('[Candidate Profile] SQL:', { candidateSql, placementsSql, activitiesSql });

    const [candidateSettled, placementsSettled, activitiesSettled] = await Promise.allSettled([
      candidateSql
        ? rest.query(candidateSql, 'Candidate profile')
        : Promise.resolve({ rows: [], rowCount: 0, duration: 0 }),
      placementsSql
        ? rest.query(placementsSql, 'Placements')
        : Promise.resolve({ rows: [], rowCount: 0, duration: 0 }),
      activitiesSql
        ? rest.query(activitiesSql, 'Activities')
        : Promise.resolve({ rows: [], rowCount: 0, duration: 0 }),
    ]);

    const candidateResult = candidateSettled.status === 'fulfilled' ? candidateSettled.value : { rows: [] };
    const placementsResult = placementsSettled.status === 'fulfilled' ? placementsSettled.value : { rows: [] };
    const activitiesResult = activitiesSettled.status === 'fulfilled' ? activitiesSettled.value : { rows: [] };

    // Log for debugging (rate limiting handled by REST client layer)
    if (candidateSql) persistQuery({ ts: Date.now(), route: '/api/candidates/[id]', sql: candidateSql, status: candidateSettled.status === 'fulfilled' ? 'success' : 'error' });

    if (candidateSettled.status === 'rejected') console.error('[Candidate Profile] candidate query failed:', candidateSettled.reason);
    if (placementsSettled.status === 'rejected') console.warn('[Candidate Profile] placements query failed:', placementsSettled.reason);
    if (activitiesSettled.status === 'rejected') console.warn('[Candidate Profile] activities query failed:', activitiesSettled.reason);

    return NextResponse.json({
      candidate: candidateResult.rows[0] ?? null,
      placements: placementsResult.rows,
      activities: activitiesResult.rows,
    });
  } catch (error) {
    console.error('[Candidate Profile API] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed' },
      { status: 500 }
    );
  }
}
