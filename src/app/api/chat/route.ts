import { NextRequest, NextResponse } from 'next/server';
import { LLMClient, getOpenAIClient, setOpenAIClient } from '@/lib/openai-client';
import { CDataClient, getCDataClient, setCDataClient } from '@/lib/cdata-client';
import { getRestClient } from '@/lib/cdata-rest-client';
import { getConfig, validateConfig } from '@/lib/config';
import { ChatMessage, TokenUsage, LLMProvider } from '@/types';
import { invokeTIPGraph } from '@/lib/agents/graph';
import { gatewayCheck, recordOutcome, incrementGlobalCounter, persistQuery } from '@/lib/rate-limiter';

// Read per-user credentials from request headers
function getCredsFromHeaders(request: NextRequest): {
  llmProvider?: LLMProvider;
  llmApiKey?: string;
  llmModel?: string;
  cdataEmail?: string;
  cdataPAT?: string;
  cdataEndpoint?: string;
  lockedTables?: string[];
} {
  const llmProvider = request.headers.get('X-LLM-Provider') as LLMProvider | null;
  const llmApiKey = request.headers.get('X-LLM-API-Key');
  const llmModel = request.headers.get('X-LLM-Model');
  const cdataEmail = request.headers.get('X-CData-Email');
  const cdataPAT = request.headers.get('X-CData-PAT');
  const cdataEndpoint = request.headers.get('X-CData-Endpoint');
  const lockedTablesHeader = request.headers.get('X-Locked-Tables');

  let lockedTables: string[] | undefined;
  if (lockedTablesHeader) {
    try { lockedTables = JSON.parse(lockedTablesHeader); } catch {}
  }

  return {
    llmProvider: llmProvider || undefined,
    llmApiKey: llmApiKey || undefined,
    llmModel: llmModel || undefined,
    cdataEmail: cdataEmail || undefined,
    cdataPAT: cdataPAT || undefined,
    cdataEndpoint: cdataEndpoint || undefined,
    lockedTables,
  };
}

export async function POST(request: NextRequest) {
  try {
    const config = getConfig();

    // Get per-user credentials from headers (fallback to env)
    const headerCreds = getCredsFromHeaders(request);

    // Build + configure clients so LangGraph nodes pick them up via singletons
    if (headerCreds.llmApiKey) {
      const llmClient = new LLMClient(
        headerCreds.llmProvider || config.llm.provider,
        headerCreds.llmModel || config.llm.model,
        headerCreds.llmApiKey
      );
      setOpenAIClient(llmClient);
    } else {
      const validation = validateConfig(config);
      if (!validation.valid) {
        return NextResponse.json({ error: 'Configuration error', details: validation.errors }, { status: 500 });
      }
      // Ensure singleton is initialized
      getOpenAIClient();
    }

    if (headerCreds.cdataEmail && headerCreds.cdataPAT) {
      const cdataClient = new CDataClient(headerCreds.cdataEmail, headerCreds.cdataPAT, headerCreds.cdataEndpoint);
      setCDataClient(cdataClient);
      // Also configure REST client with same creds
      getRestClient(headerCreds.cdataEmail, headerCreds.cdataPAT);
    } else {
      if (!config.cdata.email || !config.cdata.pat) {
        return NextResponse.json({ error: 'CData configuration missing' }, { status: 500 });
      }
      getCDataClient();
      getRestClient();
    }

    const body = await request.json();
    const { message, conversationHistory = [], skipAnalysis = false, analyzeOnly = false, providedSQL, providedResults, lockedDataSources, mutationConfirmed } = body as {
      message: string;
      conversationHistory: ChatMessage[];
      skipAnalysis?: boolean;
      analyzeOnly?: boolean;
      providedSQL?: string;
      providedResults?: any[];
      lockedDataSources?: string[];
      mutationConfirmed?: boolean;
    };

    if (!message?.trim()) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }

    // analyzeOnly mode: just run the analysis LLM call with provided data (bypasses graph)
    if (analyzeOnly && providedSQL && providedResults) {
      const openai = getOpenAIClient();
      const { response, tokenUsage } = await openai.analyzeResults(
        message,
        providedSQL,
        providedResults,
        conversationHistory
      );
      return NextResponse.json({
        response,
        sql: providedSQL,
        results: [],
        tokenUsage,
        analysisOnly: true,
      });
    }

    // ── Rate limit gate ──
    const gate = gatewayCheck('/api/chat');
    if (!gate.allowed) {
      return NextResponse.json({ error: 'Rate limited', rateLimited: true, reason: gate.reason }, { status: 429 });
    }

    // ── Invoke LangGraph ──
    const effectiveLockedSources = headerCreds.lockedTables || lockedDataSources || [];

    // Convert conversation history to LangGraph message format
    const messages = conversationHistory.slice(-10).map(m => ({
      role: m.role,
      content: m.content,
    }));

    try {
      const graphResult = await invokeTIPGraph({
        userQuery: message,
        messages,
        lockedSources: effectiveLockedSources,
        mutationConfirmed: mutationConfirmed || false,
      });

      recordOutcome('/api/chat', true);
      incrementGlobalCounter();
      persistQuery({
        ts: Date.now(),
        route: '/api/chat',
        sql: graphResult.generatedSQL || undefined,
        status: 'success',
      });

      // Map graph result to API response
      const hasData = graphResult.generatedSQL && graphResult.queryResults?.length > 0;
      const hasErrors = graphResult.errors?.length > 0;

      // skipAnalysis mode: return raw data
      if (skipAnalysis && graphResult.generatedSQL) {
        return NextResponse.json({
          response: '',
          sql: graphResult.generatedSQL,
          results: graphResult.queryResults || [],
          rowCount: graphResult.queryResults?.length || 0,
          tokenUsage: graphResult.tokenUsage,
          dataOnly: true,
        });
      }

      // Build response
      let response = graphResult.analysis || '';

      // If graph had errors but no response, surface them
      if (!response && hasErrors) {
        response = `I encountered some issues: ${graphResult.errors.join('; ')}`;
      }

      return NextResponse.json({
        response,
        sql: graphResult.generatedSQL || null,
        results: graphResult.queryResults || [],
        rowCount: graphResult.queryResults?.length || 0,
        tokenUsage: graphResult.tokenUsage,
        intent: graphResult.intent?.intent,
        schemaMap: graphResult.schemaMap ? {
          subDomain: graphResult.schemaMap.subDomain,
          tableCount: Object.keys(graphResult.schemaMap.tables).length,
        } : null,
        // Phase 12: mutation metadata
        mutations: graphResult.mutations?.length ? graphResult.mutations : undefined,
        mutationConfirmed: graphResult.mutationConfirmed,
      });
    } catch (graphErr) {
      recordOutcome('/api/chat', false);
      persistQuery({ ts: Date.now(), route: '/api/chat', status: 'error' });
      throw graphErr;
    }
  } catch (error) {
    console.error('Chat API error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
