// TIP Agent Graph - LangGraph state machine for the Talent Intelligence Platform
//
// Phase 10a: Schema resolution only
// Phase 10c: Full pipeline (intentRouter -> schemaResolver -> queryBuilder -> executor -> analyzer)
// Phase 12c: Mutation pipeline (intentRouter -> schemaResolver -> mutationPlanner -> confirmGate -> executor)
//
// This graph replaces orchestrator.ts. It runs SERVER-SIDE ONLY in Next.js API routes.

import { StateGraph } from '@langchain/langgraph';
import type {
  TIPAgentState,
  IntentClassification,
  SchemaMap,
  WriteOperation,
} from './types';
import type { TokenUsage } from '@/types';

// LangGraph node imports
import { schemaResolverNode } from './nodes/schema-resolver';
import { intentRouterNode, routeByIntent } from './nodes/intent-router';
import { queryBuilderNode } from './nodes/query-builder';
import { executorNode } from './nodes/executor';
import { chatResponderNode } from './nodes/chat-responder';
import { analyzerNode } from './nodes/analyzer';
import { mutationPlannerNode } from './nodes/mutation-planner';
import { confirmGateNode } from './nodes/confirm-gate';

// ── Channel definitions for StateGraph ──

const channelDefs = {
  messages: {
    reducer: (prev: any[], next: any[]) => [...(prev || []), ...(next || [])],
    default: () => [] as any[],
  },
  userQuery: {
    reducer: (_: string, next: string) => next,
    default: () => '',
  },
  intent: {
    reducer: (_: IntentClassification | null, next: IntentClassification | null) => next,
    default: () => null as IntentClassification | null,
  },
  schemaMap: {
    reducer: (_: SchemaMap | null, next: SchemaMap | null) => next,
    default: () => null as SchemaMap | null,
  },
  lockedSources: {
    reducer: (_: string[], next: string[]) => next,
    default: () => [] as string[],
  },
  generatedSQL: {
    reducer: (_: string, next: string) => next,
    default: () => '',
  },
  queryResults: {
    reducer: (_: any[], next: any[]) => next,
    default: () => [] as any[],
  },
  analysis: {
    reducer: (_: string, next: string) => next,
    default: () => '',
  },
  mutations: {
    reducer: (_: WriteOperation[], next: WriteOperation[]) => next,
    default: () => [] as WriteOperation[],
  },
  mutationConfirmed: {
    reducer: (_: boolean, next: boolean) => next,
    default: () => false,
  },
  tokenUsage: {
    reducer: (_: TokenUsage, next: TokenUsage) => next,
    default: () => ({ promptTokens: 0, completionTokens: 0, totalTokens: 0, estimatedCost: 0 } as TokenUsage),
  },
  errors: {
    reducer: (prev: string[], next: string[]) => [...(prev || []), ...(next || [])],
    default: () => [] as string[],
  },
};

// ── Post-schema routing: query path vs mutation path ──

function routeAfterSchema(state: TIPAgentState): string {
  const intent = state.intent?.intent;
  if (intent === 'action' || intent === 'bulk') {
    return 'mutationPlanner';
  }
  return 'queryBuilder';
}

// ── Confirm gate routing: confirmed -> executor, not confirmed -> end ──

function routeAfterConfirm(state: TIPAgentState): string {
  if (state.mutationConfirmed) {
    return 'executor';
  }
  // Not confirmed: return to UI for user confirmation
  return '__end__';
}

// ── Graph Builder ──

function buildTIPGraph() {
  const graph = new StateGraph<TIPAgentState>({ channels: channelDefs as any });

  // Add all nodes
  graph.addNode('intentRouter', intentRouterNode as any);
  graph.addNode('schemaResolver', schemaResolverNode as any);
  graph.addNode('queryBuilder', queryBuilderNode as any);
  graph.addNode('executor', executorNode as any);
  graph.addNode('analyzer', analyzerNode as any);
  graph.addNode('chatResponder', chatResponderNode as any);
  graph.addNode('mutationPlanner', mutationPlannerNode as any);
  graph.addNode('confirmGate', confirmGateNode as any);

  // Entry point: classify intent first
  graph.addEdge('__start__' as any, 'intentRouter' as any);

  // Conditional routing based on intent
  // search/analyze/action/bulk -> schemaResolver, chat -> chatResponder
  graph.addConditionalEdges('intentRouter' as any, routeByIntent as any, {
    schemaResolver: 'schemaResolver',
    chatResponder: 'chatResponder',
  } as any);

  // After schema: route to queryBuilder (reads) or mutationPlanner (writes)
  graph.addConditionalEdges('schemaResolver' as any, routeAfterSchema as any, {
    queryBuilder: 'queryBuilder',
    mutationPlanner: 'mutationPlanner',
  } as any);

  // Query path: queryBuilder -> executor -> analyzer -> end
  graph.addEdge('queryBuilder' as any, 'executor' as any);
  graph.addEdge('executor' as any, 'analyzer' as any);
  graph.addEdge('analyzer' as any, '__end__' as any);

  // Mutation path: mutationPlanner -> confirmGate -> (executor | end)
  graph.addEdge('mutationPlanner' as any, 'confirmGate' as any);
  graph.addConditionalEdges('confirmGate' as any, routeAfterConfirm as any, {
    executor: 'executor',
    '__end__': '__end__',
  } as any);

  // Chat path: chatResponder -> end
  graph.addEdge('chatResponder' as any, '__end__' as any);

  return graph.compile();
}

// ── Singleton Compiled Graph ──

let compiledGraph: ReturnType<typeof buildTIPGraph> | null = null;

export function getTIPGraph() {
  if (!compiledGraph) {
    compiledGraph = buildTIPGraph();
    console.log('[TIP Graph] Compiled LangGraph state machine (with mutation pipeline)');
  }
  return compiledGraph;
}

// Force recompile (needed when nodes are added/changed at runtime)
export function resetTIPGraph(): void {
  compiledGraph = null;
}

// ── Invoke Helper ──
// Main entry point for API routes to invoke the graph

export async function invokeTIPGraph(input: {
  userQuery: string;
  messages?: any[];
  lockedSources?: string[];
  mutationConfirmed?: boolean;
}): Promise<TIPAgentState> {
  const graph = getTIPGraph();

  const result = await graph.invoke({
    userQuery: input.userQuery,
    messages: input.messages || [],
    lockedSources: input.lockedSources || [],
    mutationConfirmed: input.mutationConfirmed || false,
  } as any);

  return result as unknown as TIPAgentState;
}

export type { TIPAgentState };
