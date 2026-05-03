// LangGraph Node: Analyzer
// Generates AI analysis of query results
// Used after executor for search/analyze intents

import { TIPAgentState } from '../types';
import { getOpenAIClient } from '../../openai-client';

export async function analyzerNode(
  state: TIPAgentState,
): Promise<Partial<TIPAgentState>> {
  // Skip analysis if no results or if errors prevented execution
  if (!state.queryResults?.length) {
    return {
      analysis: state.generatedSQL
        ? 'The query returned no results. Try broadening your search criteria.'
        : '',
    };
  }

  try {
    const llm = getOpenAIClient();

    const { response: analysis, tokenUsage } = await llm.analyzeResults(
      state.userQuery,
      state.generatedSQL || '',
      state.queryResults,
      (state.messages || []).slice(-5).map(m => ({
        id: '',
        role: m.role as 'user' | 'assistant' | 'system',
        content: m.content,
        timestamp: new Date(),
      })),
    );

    console.log(`[Analyzer] Generated analysis (${analysis.length} chars)`);

    return {
      analysis,
      tokenUsage: {
        promptTokens: (state.tokenUsage?.promptTokens || 0) + tokenUsage.promptTokens,
        completionTokens: (state.tokenUsage?.completionTokens || 0) + tokenUsage.completionTokens,
        totalTokens: (state.tokenUsage?.totalTokens || 0) + tokenUsage.totalTokens,
        estimatedCost: (state.tokenUsage?.estimatedCost || 0) + tokenUsage.estimatedCost,
      },
    };
  } catch (err) {
    const errorMsg = `Analysis failed: ${err instanceof Error ? err.message : 'Unknown error'}`;
    console.error(`[Analyzer] ${errorMsg}`);
    return {
      analysis: '',
      errors: [...(state.errors || []), errorMsg],
    };
  }
}
