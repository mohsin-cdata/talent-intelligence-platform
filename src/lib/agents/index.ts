// Agent system exports
export { orchestrate } from './orchestrator';  // Legacy - kept for A/B comparison
export { classifyIntent, debugIntent } from './intent-router';
export { invokeTIPGraph, getTIPGraph, resetTIPGraph } from './graph';
export type { Intent, IntentClassification, AgentContext, AgentResult, WriteOperation, AuditEntry, TIPAgentState } from './types';
export type { HRSubDomain, CanonicalStage, SemanticRole, EntityType, SchemaMap, TableMap, ColumnMapping, SchemaTier } from './types';
export { discoverSchemaAtTier, upgradeTierInBackground, getSchemaTier, resolveTableColumns } from './schema-cache';
export type { SchemaPromptOptions } from './schema-cache';
// Mutation nodes (Phase 12)
export { mutationPlannerNode } from './nodes/mutation-planner';
export { confirmGateNode } from './nodes/confirm-gate';
