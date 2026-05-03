// LangGraph Node: Intent Router
// Classifies user intent using keyword matching (no LLM call)
// Wraps existing classifyIntent() for LangGraph state compatibility

import { TIPAgentState } from '../types';
import { classifyIntent } from '../intent-router';

export async function intentRouterNode(
  state: TIPAgentState,
): Promise<Partial<TIPAgentState>> {
  const classification = classifyIntent(state.userQuery);

  console.log(
    `[IntentRouter] "${state.userQuery.substring(0, 50)}..." -> ${classification.intent} (${(classification.confidence * 100).toFixed(0)}%)`,
  );

  return { intent: classification };
}

// Conditional routing function for graph edges
export function routeByIntent(state: TIPAgentState): string {
  const intent = state.intent?.intent;

  switch (intent) {
    case 'search':
    case 'analyze':
    case 'bulk':
    case 'chain':
      return 'schemaResolver';
    case 'action':
      // Phase 12: will route to mutationPlanner. For now, route through schemaResolver
      return 'schemaResolver';
    case 'chat':
      return 'chatResponder';
    default:
      return 'chatResponder';
  }
}
