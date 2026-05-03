// ReAct Gatherer Agent - Autonomously discovers schema and queries data
// Pattern: Think -> Act -> Observe -> Repeat (max 6 iterations)
// Borrowed from LangGraph Customer Health Agent pattern

import { CDataClient } from '@/lib/cdata-client';
import { LLMClient } from '@/lib/openai-client';
import { ChatMessage, TokenUsage } from '@/types';
import { getOrDiscoverSchema, buildSchemaPrompt } from './schema-cache';
import { getCachedSQL, setCachedSQL, clearCacheEntry } from './search-agent';

const MAX_ITERATIONS = 3; // Reduced from 6 - most queries need 1-2 iterations
const GATHERER_TIMEOUT_MS = 25000; // 25s overall timeout

// ── ReAct System Prompt ──

function buildGathererPrompt(schemaPrompt: string): string {
  return `You are a ReAct data gathering agent for a Talent Intelligence Platform.
You autonomously discover and query data from CData Connect AI.

${schemaPrompt}

## Available Actions
You can perform these actions by responding with a JSON action block:

1. **query** - Execute a SQL query
   {"action": "query", "sql": "SELECT ...", "reason": "Why this query"}

2. **done** - You have enough data, provide final summary
   {"action": "done", "summary": "Your structured data summary"}

## Process
1. Analyze the user's question
2. Determine which tables and columns are relevant
3. Write and execute SQL queries (1-3 queries typically)
4. Summarize the gathered data

## Rules
- Use EXACT table and column names from the schema above
- Table names may have leading spaces - copy them exactly
- Use LIMIT 50 unless the user asks for more
- Be efficient: aim for 1-3 queries maximum
- After getting data, immediately use "done" action
- If a query fails, try a simpler version

CRITICAL: Respond with ONLY a JSON action block. No other text.
Example: {"action": "query", "sql": "SELECT [Col] FROM [Cat].[Schema].[Table] LIMIT 10", "reason": "Get initial data"}`;
}

// ── Parse Agent Response ──

interface AgentAction {
  action: 'query' | 'done';
  sql?: string;
  reason?: string;
  summary?: string;
}

function parseAgentAction(content: string): AgentAction | null {
  try {
    // Try direct JSON parse
    return JSON.parse(content);
  } catch {
    // Try to extract JSON from markdown code block
    const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (jsonMatch) {
      try { return JSON.parse(jsonMatch[1]); } catch {}
    }

    // Try to find JSON object in response
    const objectMatch = content.match(/\{[\s\S]*\}/);
    if (objectMatch) {
      try { return JSON.parse(objectMatch[0]); } catch {}
    }

    // Check if response contains SQL directly (some models skip JSON wrapper)
    const sqlMatch = content.match(/^(?:sql\s+)?(SELECT[\s\S]+)/i);
    if (sqlMatch) {
      return { action: 'query', sql: sqlMatch[1].trim(), reason: 'Direct SQL response' };
    }

    return null;
  }
}

// ── ReAct Loop ──

export async function gatherData(
  llm: LLMClient,
  cdata: CDataClient,
  userMessage: string,
  conversationHistory: ChatMessage[],
  lockedTables?: string[],
): Promise<{
  results: any[];
  sql: string;
  duration: number;
  error: string | null;
  tokenUsage: TokenUsage;
  summary?: string;
}> {
  const startTime = Date.now();
  let allResults: any[] = [];
  let allSQL: string[] = [];
  let error: string | null = null;
  let summary: string | undefined;
  let totalTokens: TokenUsage = {
    promptTokens: 0,
    completionTokens: 0,
    totalTokens: 0,
    estimatedCost: 0,
  };

  // Check SQL cache first
  const cachedSQL = getCachedSQL(userMessage);
  if (cachedSQL) {
    console.log('[Gatherer] Cache HIT - executing cached SQL');
    try {
      const { rows, duration } = await cdata.queryData(cachedSQL, userMessage);
      return {
        results: rows,
        sql: cachedSQL,
        duration: Date.now() - startTime,
        error: null,
        tokenUsage: totalTokens,
      };
    } catch (err) {
      clearCacheEntry(userMessage);
      console.log('[Gatherer] Cached SQL failed, falling through to ReAct loop');
    }
  }

  try {
    // Get or discover schema
    const schema = await getOrDiscoverSchema(cdata);
    const schemaPrompt = buildSchemaPrompt(schema, lockedTables);
    const systemPrompt = buildGathererPrompt(schemaPrompt);

    // ReAct loop
    const messages: { role: 'system' | 'user' | 'assistant'; content: string }[] = [
      { role: 'system', content: systemPrompt },
      ...conversationHistory.slice(-3).map(msg => ({
        role: msg.role as 'user' | 'assistant',
        content: msg.content,
      })),
      { role: 'user', content: userMessage },
    ];

    for (let i = 0; i < MAX_ITERATIONS; i++) {
      console.log(`[Gatherer] Iteration ${i + 1}/${MAX_ITERATIONS}`);

      // Get LLM response
      const response = await llm.rawCompletion(messages, {
        temperature: 0.1,
        maxTokens: 1000,
      });

      const content = response.content;
      const promptTokens = response.promptTokens || 0;
      const completionTokens = response.completionTokens || 0;

      totalTokens = {
        promptTokens: totalTokens.promptTokens + promptTokens,
        completionTokens: totalTokens.completionTokens + completionTokens,
        totalTokens: totalTokens.totalTokens + promptTokens + completionTokens,
        estimatedCost: totalTokens.estimatedCost + response.estimatedCost,
      };

      // Parse action
      const action = parseAgentAction(content);

      if (!action) {
        console.log('[Gatherer] Could not parse agent response, treating as done');
        summary = content;
        break;
      }

      if (action.action === 'done') {
        summary = action.summary;
        console.log('[Gatherer] Agent signaled done');
        break;
      }

      if (action.action === 'query' && action.sql) {
        console.log(`[Gatherer] Executing: ${action.sql}`);
        allSQL.push(action.sql);

        // Check overall timeout
        if (Date.now() - startTime > GATHERER_TIMEOUT_MS) {
          console.log('[Gatherer] Timeout reached, stopping');
          break;
        }

        try {
          const { rows, duration } = await cdata.queryData(action.sql, action.reason || userMessage);
          console.log(`[Gatherer] Got ${rows.length} rows in ${duration}ms`);

          allResults = rows;

          // Cache the first successful SQL
          if (allSQL.length === 1) {
            setCachedSQL(userMessage, action.sql);
          }

          // If we got results, we're done -- no need to ask LLM for more
          if (rows.length > 0) {
            console.log('[Gatherer] Got results, stopping loop');
            break;
          }

          // No results -- feed back and let agent try a different query
          messages.push(
            { role: 'assistant', content: content },
            { role: 'user', content: `Query returned 0 rows. Try a broader query or {"action": "done", "summary": "no results found"}.` }
          );
        } catch (queryErr) {
          const errMsg = queryErr instanceof Error ? queryErr.message : 'Query failed';
          console.log(`[Gatherer] Query error: ${errMsg}`);

          messages.push(
            { role: 'assistant', content: content },
            { role: 'user', content: `Query failed: ${errMsg}\n\nTry a simpler query or respond with {"action": "done", "summary": "explanation"}.` }
          );
        }
      }
    }

    if (allSQL.length === 0 && !summary) {
      error = 'Gatherer agent could not generate any queries';
    }
  } catch (err) {
    error = err instanceof Error ? err.message : 'Gatherer agent failed';
    console.error('[Gatherer] Error:', err);
  }

  return {
    results: allResults,
    sql: allSQL.join('\n\n'),
    duration: Date.now() - startTime,
    error,
    tokenUsage: totalTokens,
    summary,
  };
}
