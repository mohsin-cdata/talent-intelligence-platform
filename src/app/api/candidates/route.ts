// Dynamic candidates list — REST only, no MCP
// Discovers the candidates table from schema cache then queries via REST POST /query

import { NextRequest, NextResponse } from 'next/server';
import { getOrDiscoverSchema, findTable } from '@/lib/agents/schema-cache';
import { CDataRestClient } from '@/lib/cdata-rest-client';
import { getCDataClient } from '@/lib/cdata-client';
import { getConfig } from '@/lib/config';
import { resolveColumnName } from '@/lib/field-resolver';
import { gatewayCheck, recordOutcome, incrementGlobalCounter, setDedupResult, persistQuery } from '@/lib/rate-limiter';

export async function GET(request: NextRequest) {
  try {
    const config = getConfig();
    const headerEmail = request.headers.get('x-cdata-email');
    const headerPAT = request.headers.get('x-cdata-pat');
    const email = headerEmail || config.cdata.email;
    const pat = headerPAT || config.cdata.pat;

    if (!email || !pat) {
      return NextResponse.json({ results: [], error: 'CData not configured' }, { status: 400 });
    }

    const rest = new CDataRestClient(email, pat);
    const mcp = (headerEmail && headerPAT)
      ? getCDataClient()
      : getCDataClient();

    // Discover schema (REST-first, MCP last resort)
    const schema = await getOrDiscoverSchema(mcp, rest);

    const candidatesTable = findTable(schema, 'candidate');
    if (!candidatesTable) {
      console.log('[Candidates API] No candidates table found in schema');
      return NextResponse.json({ results: [], schema: 'no candidates table found' });
    }

    // Resolve actual column names for ORDER BY
    const match = candidatesTable.match(/^\[([^\]]+)\]\.\[([^\]]+)\]\.\[([^\]]+)\]$/);
    const colKey = match ? `${match[1]}.${match[2]}.${match[3]}` : '';
    const cols = (colKey && schema.columns[colKey]) ? schema.columns[colKey].map((c: any) => c.name) : [];
    const lastNameCol = resolveColumnName('lastName', cols);
    const firstNameCol = resolveColumnName('firstName', cols);
    const orderBy = lastNameCol && firstNameCol
      ? ` ORDER BY [${lastNameCol}], [${firstNameCol}]`
      : lastNameCol ? ` ORDER BY [${lastNameCol}]` : '';
    const sql = `SELECT * FROM ${candidatesTable}${orderBy} LIMIT 100`;
    console.log(`[Candidates API] REST query: ${candidatesTable}`);

    const gate = gatewayCheck('/api/candidates', sql);
    if (!gate.allowed) {
      return NextResponse.json({ results: [], rateLimited: true, reason: gate.reason }, { status: 429 });
    }
    if (gate.cachedResult) {
      return NextResponse.json(gate.cachedResult);
    }

    try {
      const { rows, duration } = await rest.query(sql, 'Sidebar candidates list');
      const responseData = { results: rows, duration, table: candidatesTable, via: 'rest' };
      recordOutcome('/api/candidates', true);
      incrementGlobalCounter();
      setDedupResult(sql, responseData);
      persistQuery({ ts: Date.now(), route: '/api/candidates', sql, status: 'success' });
      return NextResponse.json(responseData);
    } catch (queryError) {
      recordOutcome('/api/candidates', false);
      persistQuery({ ts: Date.now(), route: '/api/candidates', sql, status: 'error' });
      throw queryError;
    }
  } catch (error) {
    console.error('[Candidates API] Error:', error);
    return NextResponse.json(
      { results: [], error: error instanceof Error ? error.message : 'Failed' },
      { status: 500 }
    );
  }
}
