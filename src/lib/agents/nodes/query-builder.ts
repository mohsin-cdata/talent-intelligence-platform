// LangGraph Node: Query Builder
// Generates SQL from natural language using schema + LLM
// Phase 13: When lockedSources > 1, generates native federated SQL with cross-catalog JOINs
//
// Uses LLMClient.generateSQL() which returns {sql, explanation, tokenUsage}

import { TIPAgentState } from '../types';
import { buildSchemaPrompt, getCachedSchema, discoverSchemaAtTier } from '../schema-cache';
import { getRestClient } from '../../cdata-rest-client';
import { getCDataClient } from '../../cdata-client';
import { getOpenAIClient } from '../../openai-client';

export async function queryBuilderNode(
  state: TIPAgentState,
): Promise<Partial<TIPAgentState>> {
  try {
    // Use cached schema (schema-resolver already populated columns for locked sources)
    let cache = getCachedSchema();
    if (!cache) {
      const rest = getRestClient();
      const mcp = getCDataClient();
      cache = await discoverSchemaAtTier(2, rest, mcp);
    }

    // Map targetTable from intent to EntityType for filtering
    const targetTable = state.intent?.entities?.targetTable;
    const entityTypeMap: Record<string, string> = {
      candidates: 'person', jobs: 'job', placements: 'placement',
      clients: 'organization', activities: 'activity', skills: 'generic',
    };
    const relevantEntities = targetTable && entityTypeMap[targetTable]
      ? [entityTypeMap[targetTable]] as any[]
      : undefined;

    const lockedSources = state.lockedSources?.length ? state.lockedSources : undefined;
    const isFederated = lockedSources && lockedSources.length > 1;

    // Build schema prompt with federation hints when multi-source
    let schemaPrompt = buildSchemaPrompt(cache, {
      lockedSources,
      relevantEntities,
      maxTables: isFederated ? 20 : 30, // smaller prompt for federation to leave room for hints
    });

    // Append federation hints when multiple sources are selected
    if (isFederated) {
      schemaPrompt += `\nFEDERATION (${lockedSources.length} sources selected):
- Cross-catalog JOINs are supported (READ-ONLY)
- Use fully qualified names for each source: [Catalog].[Schema].[Table].[Column]
- JOIN across sources on matching keys (e.g., Email, CandidateId)
- For writes, target a SINGLE [Catalog].[Schema].[Table] only
- Federated queries are read-only -- no UPDATE/DELETE across sources
- Prefer narrower JOINs (fewer tables, specific columns) for performance
`;
    }

    // Generate SQL via LLM
    const llm = getOpenAIClient();

    const conversationHistory = (state.messages || []).slice(-5).map(m => ({
      id: '',
      role: m.role as 'user' | 'assistant' | 'system',
      content: m.content,
      timestamp: new Date(),
    }));

    const { sql, tokenUsage } = await llm.generateSQL(
      state.userQuery,
      schemaPrompt,
      conversationHistory,
    );

    if (isFederated) {
      console.log(`[QueryBuilder] Federated SQL across ${lockedSources.length} sources: ${sql.substring(0, 150)}`);
    } else {
      console.log(`[QueryBuilder] Generated SQL: ${sql.substring(0, 120)}`);
    }

    return {
      generatedSQL: sql,
      tokenUsage: {
        promptTokens: (state.tokenUsage?.promptTokens || 0) + tokenUsage.promptTokens,
        completionTokens: (state.tokenUsage?.completionTokens || 0) + tokenUsage.completionTokens,
        totalTokens: (state.tokenUsage?.totalTokens || 0) + tokenUsage.totalTokens,
        estimatedCost: (state.tokenUsage?.estimatedCost || 0) + tokenUsage.estimatedCost,
      },
    };
  } catch (err) {
    const errorMsg = `Query generation failed: ${err instanceof Error ? err.message : 'Unknown error'}`;
    console.error(`[QueryBuilder] ${errorMsg}`);
    return {
      errors: [...(state.errors || []), errorMsg],
    };
  }
}
