import { NextRequest, NextResponse } from 'next/server';
import { CDataRestClient } from '@/lib/cdata-rest-client';
import { getCDataClient, CDataClient } from '@/lib/cdata-client';
import { getConfig } from '@/lib/config';
import { gatewayCheck, recordOutcome, incrementGlobalCounter, setDedupResult, persistQuery } from '@/lib/rate-limiter';

/**
 * Direct SQL query endpoint — uses CData REST API (not MCP)
 * Faster for pre-defined queries: profile pages, lists, static loads
 * Falls back to MCP if REST fails
 */
export async function POST(request: NextRequest) {
  try {
    const config = getConfig();

    const cdataEmail = request.headers.get('X-CData-Email');
    const cdataPAT = request.headers.get('X-CData-PAT');

    const email = cdataEmail || config.cdata.email;
    const pat = cdataPAT || config.cdata.pat;

    if (!email || !pat) {
      return NextResponse.json({ error: 'CData configuration missing' }, { status: 500 });
    }

    const body = await request.json();
    const { sql, description } = body as { sql: string; description?: string };

    if (!sql?.trim()) {
      return NextResponse.json({ error: 'SQL query is required' }, { status: 400 });
    }

    const gate = gatewayCheck('/api/query', sql);
    if (!gate.allowed) {
      return NextResponse.json({ error: 'Rate limited', rateLimited: true, reason: gate.reason }, { status: 429 });
    }
    if (gate.cachedResult) {
      return NextResponse.json(gate.cachedResult);
    }

    console.log(`[Query API] ${description || 'Direct query'}`);

    // Try REST first (no MCP overhead)
    try {
      const rest = new CDataRestClient(email, pat);
      const { rows, rowCount, duration } = await rest.query(sql, description);
      const responseData = { results: rows, rowCount, duration, via: 'rest' };
      recordOutcome('/api/query', true);
      incrementGlobalCounter();
      setDedupResult(sql, responseData);
      persistQuery({ ts: Date.now(), route: '/api/query', sql, status: 'success' });
      return NextResponse.json(responseData);
    } catch (restErr) {
      console.log(`[Query API] REST failed, falling back to MCP: ${(restErr as Error).message}`);
    }

    // MCP fallback
    const cdata: CDataClient = (cdataEmail && cdataPAT)
      ? new CDataClient(cdataEmail, cdataPAT)
      : getCDataClient();

    try {
      const { rows, rowCount, duration } = await cdata.queryData(sql, description || 'Direct query');
      const responseData = { results: rows, rowCount, duration, via: 'mcp' };
      recordOutcome('/api/query', true);
      incrementGlobalCounter();
      setDedupResult(sql, responseData);
      persistQuery({ ts: Date.now(), route: '/api/query', sql, status: 'success' });
      return NextResponse.json(responseData);
    } catch (mcpErr) {
      recordOutcome('/api/query', false);
      persistQuery({ ts: Date.now(), route: '/api/query', sql, status: 'error' });
      throw mcpErr;
    }

  } catch (error) {
    console.error('[Query API] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Query failed' },
      { status: 500 }
    );
  }
}
