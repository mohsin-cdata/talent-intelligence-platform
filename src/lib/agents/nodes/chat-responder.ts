// LangGraph Node: Chat Responder
// Handles general conversation that doesn't need data queries
// Simple LLM response with conversation context

import { TIPAgentState } from '../types';
import { getOpenAIClient } from '../../openai-client';

export async function chatResponderNode(
  state: TIPAgentState,
): Promise<Partial<TIPAgentState>> {
  try {
    const llm = getOpenAIClient();

    const conversationHistory = (state.messages || []).slice(-10).map(m => ({
      id: '',
      role: m.role as 'user' | 'assistant' | 'system',
      content: m.content,
      timestamp: new Date(),
    }));

    const { response, tokenUsage } = await llm.chat(
      state.userQuery,
      conversationHistory,
    );

    console.log(`[ChatResponder] Response: ${response.substring(0, 80)}...`);

    return {
      analysis: response,
      tokenUsage: {
        promptTokens: (state.tokenUsage?.promptTokens || 0) + tokenUsage.promptTokens,
        completionTokens: (state.tokenUsage?.completionTokens || 0) + tokenUsage.completionTokens,
        totalTokens: (state.tokenUsage?.totalTokens || 0) + tokenUsage.totalTokens,
        estimatedCost: (state.tokenUsage?.estimatedCost || 0) + tokenUsage.estimatedCost,
      },
    };
  } catch (err) {
    const errorMsg = `Chat response failed: ${err instanceof Error ? err.message : 'Unknown error'}`;
    console.error(`[ChatResponder] ${errorMsg}`);
    return {
      analysis: 'I encountered an error processing your request. Please try again.',
      errors: [...(state.errors || []), errorMsg],
    };
  }
}
