// Agent Orchestrator - Routes classified intents to the appropriate agent pipeline
// Phase 1: Routes search + chat (existing), stubs action/bulk/chain/analyze for Phase 2-6

import { AgentContext, AgentResult, Intent } from './types';
import { classifyIntent } from './intent-router';
import { ChatMessage, TokenUsage, LLMProvider } from '@/types';
import { CDataClient } from '@/lib/cdata-client';
import { LLMClient } from '@/lib/openai-client';

// ── Search Agent ──
// Uses legacy runAgentLoop (reliable 4-6s, proven SQL generation)
// Gatherer agent is used by analyze/chain, not plain search

async function handleSearch(ctx: AgentContext): Promise<AgentResult> {
  const { getSchema, runAgentLoop, detectRelationalQuery, executeRelationalQuery } = await import('./search-agent');

  // Name-based lookups use relational query path
  const relationalInfo = detectRelationalQuery(ctx.message);
  if (relationalInfo.isRelational) {
    try {
      const result = await executeRelationalQuery(relationalInfo, ctx.cdata);
      return {
        response: '',
        sql: result.sql,
        results: result.rows,
        rowCount: result.rows.length,
        queryDuration: result.duration,
        tokenUsage: { promptTokens: 0, completionTokens: 0, totalTokens: 0, estimatedCost: 0 },
      };
    } catch (error) {
      return {
        response: `Relational query failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        tokenUsage: { promptTokens: 0, completionTokens: 0, totalTokens: 0, estimatedCost: 0 },
      };
    }
  }

  // Always use live schema from cache (REST-discovered)
  // If cache is empty, discover now — this is the single source of truth
  const { getOrDiscoverSchema, buildSchemaPrompt } = await import('./schema-cache');
  const { getRestClient } = await import('@/lib/cdata-rest-client');

  const schemaData = await getOrDiscoverSchema(ctx.cdata, getRestClient());
  const schema = buildSchemaPrompt(schemaData, ctx.lockedTables);

  const result = await runAgentLoop(ctx.llm, ctx.cdata, ctx.message, schema, ctx.conversationHistory);

  return {
    response: '',
    sql: result.sql,
    results: result.results,
    rowCount: result.results.length,
    queryDuration: result.duration,
    tokenUsage: result.tokenUsage,
  };
}

// ── Analyze Agent (scoring, ranking, comparison via analyst-agent) ──

async function handleAnalyze(ctx: AgentContext): Promise<AgentResult> {
  try {
    const { analyzeData } = await import('./analyst-agent');
    console.log('[Orchestrator] Using Analyst Agent');

    const result = await analyzeData(ctx.llm, ctx.cdata, ctx.message, ctx.conversationHistory, ctx.lockedTables);

    return {
      response: result.response,
      sql: result.sql,
      results: result.results,
      rowCount: result.results.length,
      queryDuration: result.duration,
      tokenUsage: result.tokenUsage,
    };
  } catch (error) {
    console.error('[Orchestrator] Analyst agent error, falling back to search:', error);
    return handleSearch(ctx);
  }
}

// ── Action Agent (write operations with confirmation + audit) ──

async function handleAction(ctx: AgentContext): Promise<AgentResult> {
  try {
    const { executeAction } = await import('./action-agent');
    console.log('[Orchestrator] Using Action Agent');

    const result = await executeAction(ctx.llm, ctx.cdata, ctx.message, ctx.conversationHistory, ctx.intent);

    return {
      response: result.response,
      writeOperations: result.writeOperations,
      tokenUsage: result.tokenUsage,
    };
  } catch (error) {
    return {
      response: `Action failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      tokenUsage: { promptTokens: 0, completionTokens: 0, totalTokens: 0, estimatedCost: 0 },
    };
  }
}

// ── Bulk Agent (batch operations with preview + confirmation) ──

async function handleBulk(ctx: AgentContext): Promise<AgentResult> {
  try {
    const { executeBulk } = await import('./bulk-agent');
    console.log('[Orchestrator] Using Bulk Agent');

    const result = await executeBulk(ctx.llm, ctx.cdata, ctx.message, ctx.conversationHistory, ctx.intent);

    return {
      response: result.response,
      writeOperations: result.writeOperations,
      tokenUsage: result.tokenUsage,
    };
  } catch (error) {
    return {
      response: `Bulk operation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      tokenUsage: { promptTokens: 0, completionTokens: 0, totalTokens: 0, estimatedCost: 0 },
    };
  }
}

// ── Chain Agent (multi-step autonomous workflows) ──

async function handleChain(ctx: AgentContext): Promise<AgentResult> {
  try {
    const { executeChain } = await import('./chain-agent');
    console.log('[Orchestrator] Using Chain Agent');

    const result = await executeChain(ctx.llm, ctx.cdata, ctx.message, ctx.conversationHistory, ctx.intent, ctx.lockedTables);

    return {
      response: result.response,
      sql: result.sql,
      results: result.results,
      rowCount: result.results.length,
      queryDuration: result.duration,
      tokenUsage: result.tokenUsage,
    };
  } catch (error) {
    return {
      response: `Chain workflow failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      tokenUsage: { promptTokens: 0, completionTokens: 0, totalTokens: 0, estimatedCost: 0 },
    };
  }
}

// ── Chat Handler (existing general chat) ──

async function handleChat(ctx: AgentContext): Promise<AgentResult> {
  const { response, tokenUsage } = await ctx.llm.chat(ctx.message, ctx.conversationHistory);

  return {
    response,
    tokenUsage,
  };
}

// ── Agent Map ──

const AGENT_HANDLERS: Record<Intent, (ctx: AgentContext) => Promise<AgentResult>> = {
  search: handleSearch,
  analyze: handleAnalyze,
  action: handleAction,
  bulk: handleBulk,
  chain: handleChain,
  chat: handleChat,
};

// ── Main Orchestrator ──

export async function orchestrate(
  llm: LLMClient,
  cdata: CDataClient,
  message: string,
  conversationHistory: ChatMessage[],
  lockedTables?: string[],
): Promise<AgentResult> {
  // Step 1: Classify intent (no LLM call, pure keyword matching)
  const intent = classifyIntent(message);
  console.log(`[Orchestrator] Intent: ${intent.intent} (${(intent.confidence * 100).toFixed(0)}% confidence)`);

  // Step 1b: Assess query complexity for model routing
  const { assessComplexity } = await import('./model-router');
  const routing = assessComplexity(message, intent.intent);
  console.log(`[Orchestrator] Complexity: ${routing.complexity} (${routing.reason})`);

  // Step 2: Build agent context
  const ctx: AgentContext = {
    llm,
    cdata,
    message,
    conversationHistory,
    lockedTables,
    intent,
  };

  // Step 3: Route to appropriate agent handler
  const handler = AGENT_HANDLERS[intent.intent];
  const result = await handler(ctx);

  // Log routing decision
  console.log(`[Orchestrator] ${intent.intent} agent completed. Tokens: ${result.tokenUsage.totalTokens}`);

  return result;
}
