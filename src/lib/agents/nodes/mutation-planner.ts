// LangGraph Node: Mutation Planner (Phase 12c)
//
// Generates mutation SQL (UPDATE/INSERT/DELETE) from user intent + schema map.
// Returns the SQL, extracted table, risk assessment, and WriteOperation metadata.

import { TIPAgentState, WriteOperation } from '../types';
import { buildSchemaPrompt, getOrDiscoverSchema } from '../schema-cache';
import { getRestClient } from '../../cdata-rest-client';
import { getCDataClient } from '../../cdata-client';
import { getOpenAIClient } from '../../openai-client';
import { assessRisk, detectDMLType, extractTable, validateMutationTarget } from '../../mutation-manager';

export async function mutationPlannerNode(
  state: TIPAgentState,
): Promise<Partial<TIPAgentState>> {
  try {
    const rest = getRestClient();
    const mcp = getCDataClient();
    const cache = await getOrDiscoverSchema(mcp, rest);

    // Build schema prompt for mutation context
    const schemaPrompt = buildSchemaPrompt(cache, {
      lockedSources: state.lockedSources?.length ? state.lockedSources : undefined,
      maxTables: 20,
    });

    const llm = getOpenAIClient();

    // Build conversation history for context
    const conversationHistory = (state.messages || []).slice(-5).map(m => ({
      id: '',
      role: m.role as 'user' | 'assistant' | 'system',
      content: m.content,
      timestamp: new Date(),
    }));

    // Generate mutation SQL via LLM
    // Use generateSQL which handles schema context and returns structured {sql, tokenUsage}
    const mutationSchemaPrompt = schemaPrompt + `\nMUTATION RULES:
- Generate a single SQL mutation (UPDATE, INSERT, or DELETE)
- Always include a WHERE clause for UPDATE and DELETE
- For UPDATE: SET only the fields the user mentions
- For INSERT: include all required fields
- Return ONLY the SQL statement`;

    const { sql: rawSql, tokenUsage } = await llm.generateSQL(
      state.userQuery,
      mutationSchemaPrompt,
      conversationHistory,
    );

    const response = rawSql;

    // Strip markdown fences if present
    let sql = response.trim();
    if (sql.startsWith('```')) {
      sql = sql.replace(/^```(?:sql)?\n?/, '').replace(/\n?```$/, '').trim();
    }

    const risk = assessRisk(sql);
    const dmlType = detectDMLType(sql);
    const table = extractTable(sql);

    // Phase 13d: Validate mutation target (single source, writable)
    const writableCatalogs = state.lockedSources || [];
    const validation = validateMutationTarget(sql, writableCatalogs);
    if (!validation.valid) {
      console.log(`[MutationPlanner] Mutation blocked: ${validation.error}`);
      return {
        generatedSQL: sql,
        mutations: [],
        analysis: `Mutation blocked: ${validation.error}`,
        errors: [...(state.errors || []), validation.error!],
      };
    }

    console.log(`[MutationPlanner] ${dmlType} on ${table} (risk: ${risk}): ${sql.substring(0, 100)}`);

    // Build WriteOperation metadata
    const operation: WriteOperation = {
      type: dmlType,
      table,
      recordId: '', // extracted from WHERE clause if possible
      oldValue: undefined,
      newValue: state.intent?.entities?.newValue,
      timestamp: new Date().toISOString(),
      confirmed: false,
    };

    return {
      generatedSQL: sql,
      mutations: [operation],
      analysis: `Planned ${dmlType.toUpperCase()} on ${table} (risk: ${risk})`,
      tokenUsage: {
        promptTokens: (state.tokenUsage?.promptTokens || 0) + tokenUsage.promptTokens,
        completionTokens: (state.tokenUsage?.completionTokens || 0) + tokenUsage.completionTokens,
        totalTokens: (state.tokenUsage?.totalTokens || 0) + tokenUsage.totalTokens,
        estimatedCost: (state.tokenUsage?.estimatedCost || 0) + tokenUsage.estimatedCost,
      },
    };
  } catch (err) {
    const errorMsg = `Mutation planning failed: ${err instanceof Error ? err.message : 'Unknown error'}`;
    console.error(`[MutationPlanner] ${errorMsg}`);
    return {
      errors: [...(state.errors || []), errorMsg],
    };
  }
}
