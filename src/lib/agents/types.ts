// Agent system types for Talent Intelligence Platform

import { TokenUsage, ChatMessage, LLMProvider } from '@/types';
import { CDataClient } from '@/lib/cdata-client';
import { LLMClient } from '@/lib/openai-client';

// ── Schema Mapping Types (Phase 10a) ──

export type HRSubDomain = 'staffing' | 'ats' | 'hris' | 'generic_hr' | 'generic';

export type CanonicalStage = 'sourced' | 'screening' | 'submitted' | 'interview' | 'offer' | 'placed';

export type SemanticRole =
  | 'primary_id' | 'primary_name' | 'secondary_name' | 'title' | 'description'
  | 'email' | 'phone' | 'url' | 'city' | 'state' | 'zip'
  | 'status' | 'category' | 'rate' | 'rating' | 'experience' | 'amount'
  | 'date_created' | 'date_modified' | 'date_start' | 'date_end'
  | 'tags' | 'parent_id' | 'owner';

export type EntityType = 'person' | 'job' | 'placement' | 'activity' | 'organization' | 'generic';

export interface ColumnMapping {
  role: SemanticRole;
  columnName: string;
  confidence: number;
}

export interface TableMap {
  fullyQualifiedName: string;
  entityType: EntityType;
  columns: ColumnMapping[];
  subDomain: HRSubDomain;
}

export interface SchemaMap {
  tables: Record<string, TableMap>;
  subDomain: HRSubDomain;
  timestamp: number;
}

// ── LangGraph Agent State (Phase 10a) ──

export interface TIPAgentState {
  messages: any[];                  // BaseMessage[] from LangChain
  userQuery: string;
  intent: IntentClassification | null;
  schemaMap: SchemaMap | null;
  lockedSources: string[];
  generatedSQL: string;
  queryResults: any[];
  analysis: string;
  mutations: WriteOperation[];
  mutationConfirmed: boolean;
  tokenUsage: TokenUsage;
  errors: string[];
}

// ── Intent Classification ──

export type Intent =
  | 'search'    // Find/show/list data (read-only)
  | 'analyze'   // Score, rank, compare candidates/jobs
  | 'action'    // Update status, log activity, edit profile (single write)
  | 'bulk'      // Batch operations on multiple records
  | 'chain'     // Multi-step autonomous workflows
  | 'chat';     // General conversation, no data needed

export interface IntentClassification {
  intent: Intent;
  confidence: number;       // 0-1
  entities: ParsedEntities;
  originalMessage: string;
}

export interface ParsedEntities {
  candidateNames?: string[];
  jobTitles?: string[];
  skills?: string[];
  statuses?: string[];
  targetTable?: 'candidates' | 'jobs' | 'placements' | 'clients' | 'activities' | 'skills';
  actionVerb?: string;       // update, move, log, add, remove, assign
  newValue?: string;         // the value to set (e.g., "Active", "Interviewed")
  bulkSelector?: string;     // "all", "stale", "uncontacted"
  chainType?: string;        // "fillReq", "cleanup", "brief", "candidate360", "eod"
}

// ── Agent Context ──

export interface AgentContext {
  llm: LLMClient;
  cdata: CDataClient;
  message: string;
  conversationHistory: ChatMessage[];
  lockedTables?: string[];
  intent: IntentClassification;
}

// ── Agent Result ──

export interface AgentResult {
  response: string;
  sql?: string;
  results?: any[];
  rowCount?: number;
  queryDuration?: number;
  tokenUsage: TokenUsage;
  dataOnly?: boolean;
  analysisOnly?: boolean;
  writeOperations?: WriteOperation[];
}

export interface WriteOperation {
  type: 'update' | 'insert' | 'delete';
  table: string;
  recordId: string;
  field?: string;
  oldValue?: string;
  newValue?: string;
  timestamp: string;
  confirmed: boolean;
}

// ── Audit Log ──

export interface AuditEntry {
  id: string;
  timestamp: string;
  userId: string;
  intent: Intent;
  operations: WriteOperation[];
  undoAvailable: boolean;
  undoExpiry: string;  // ISO timestamp, 24hr from creation
}

// ── Schema Cache ──

export type SchemaTier = 1 | 2 | 3;

export interface CachedSchema {
  catalogs: string[];
  schemas: Record<string, string[]>;              // catalog -> schemas
  tables: Record<string, string[]>;               // catalog.schema -> tables
  columns: Record<string, { name: string; type: string }[]>; // catalog.schema.table -> columns
  timestamp: number;
  ttlMs: number;
  tier: SchemaTier;                               // 1=catalogs, 2=+tables, 3=+columns
}
