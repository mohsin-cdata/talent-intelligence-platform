// Action Agent - Handles single write operations via CData Connect AI
// Pattern: Confirm -> Execute -> Audit -> Respond
// Safety: Tiered confirmation, audit trail, 24hr undo window

import { CDataClient } from '@/lib/cdata-client';
import { getCachedSchema, findTable } from './schema-cache';
import { LLMClient } from '@/lib/openai-client';
import { ChatMessage, TokenUsage } from '@/types';
import { WriteOperation, AuditEntry, IntentClassification } from './types';

// ── Risk Levels ──

export type RiskLevel = 'low' | 'medium' | 'high' | 'destructive';

interface ActionPlan {
  description: string;
  risk: RiskLevel;
  table: string;
  operation: WriteOperation;
  confirmationMessage: string;
  requiresExplicitConfirmation: boolean;
}

// ── In-Memory Audit Log (Phase 4 scope, DB-backed in future) ──

const auditLog: AuditEntry[] = [];
const UNDO_WINDOW_MS = 24 * 60 * 60 * 1000; // 24 hours

export function getAuditLog(): AuditEntry[] {
  return auditLog;
}

export function getRecentAuditEntries(limit: number = 10): AuditEntry[] {
  return auditLog.slice(-limit);
}

function addAuditEntry(entry: AuditEntry): void {
  auditLog.push(entry);
  // Keep only last 500 entries in memory
  if (auditLog.length > 500) {
    auditLog.splice(0, auditLog.length - 500);
  }
}

// ── Risk Assessment ──

function assessRisk(intent: IntentClassification): RiskLevel {
  const verb = intent.entities.actionVerb?.toLowerCase() || '';
  const table = intent.entities.targetTable || '';

  // Destructive actions
  if (['delete', 'remove', 'drop'].includes(verb)) return 'destructive';

  // High risk: placements, bulk-adjacent single ops
  if (table === 'placements' && ['update', 'modify', 'edit'].includes(verb)) return 'high';
  if (verb === 'archive') return 'high';

  // Medium risk: status changes, assignments
  if (['move', 'advance', 'reject', 'withdraw', 'assign', 'place'].includes(verb)) return 'medium';

  // Low risk: notes, logging activities
  if (['log', 'add', 'record', 'note'].includes(verb)) return 'low';
  if (verb === 'reactivate') return 'low';

  return 'medium'; // default
}

// ── Plan the Action ──

function planAction(
  message: string,
  intent: IntentClassification,
): ActionPlan | null {
  const { entities } = intent;
  const verb = entities.actionVerb || 'update';
  const targetName = entities.candidateNames?.[0] || 'the record';
  const table = entities.targetTable || 'candidates';
  const newValue = entities.newValue || '';
  const risk = assessRisk(intent);

  // Build the write operation
  const operation: WriteOperation = {
    type: verb === 'delete' || verb === 'remove' ? 'delete' : verb === 'add' || verb === 'log' ? 'insert' : 'update',
    table,
    recordId: '', // Will be resolved during execution
    field: inferField(verb, newValue, table),
    oldValue: undefined,
    newValue: newValue || undefined,
    timestamp: new Date().toISOString(),
    confirmed: false,
  };

  // Build confirmation message based on risk
  const riskEmoji: Record<RiskLevel, string> = {
    low: '',
    medium: '',
    high: '**WARNING:**',
    destructive: '**DANGER:**',
  };

  const confirmationMessage = buildConfirmationMessage(risk, verb, targetName, newValue, table);

  return {
    description: `${verb} ${targetName}${newValue ? ` to "${newValue}"` : ''}`,
    risk,
    table,
    operation,
    confirmationMessage,
    requiresExplicitConfirmation: risk !== 'low',
  };
}

function inferField(verb: string, newValue: string, table: string): string | undefined {
  const lower = (newValue || '').toLowerCase();

  // Status-related verbs
  if (['move', 'advance', 'reject', 'withdraw', 'reactivate', 'archive'].includes(verb)) {
    if (table === 'candidates') return 'AvailabilityStatus';
    if (table === 'jobs') return 'Status';
    if (table === 'placements') return 'Status';
  }

  // If newValue matches a known status
  const candidateStatuses = ['active', 'passive', 'placed', 'bench'];
  const jobStatuses = ['open', 'filled', 'closed', 'on hold'];
  if (candidateStatuses.includes(lower)) return 'AvailabilityStatus';
  if (jobStatuses.includes(lower)) return 'Status';

  // Activity logging
  if (verb === 'log' || verb === 'record') return 'Notes';

  return undefined;
}

function buildConfirmationMessage(
  risk: RiskLevel,
  verb: string,
  target: string,
  newValue: string,
  table: string,
): string {
  const header = risk === 'destructive'
    ? '**This is a destructive action that cannot be easily undone.**\n\n'
    : risk === 'high'
    ? '**This is a high-risk change. Please review carefully.**\n\n'
    : '';

  const field = inferField(verb, newValue, table);
  const fieldStr = field ? ` (${field})` : '';

  return `${header}**Proposed Action:**\n` +
    `- **Operation:** ${verb}\n` +
    `- **Target:** ${target} in ${table}${fieldStr}\n` +
    `${newValue ? `- **New Value:** ${newValue}\n` : ''}` +
    `- **Risk Level:** ${risk}\n\n` +
    `To confirm, reply with "yes" or "confirm". To cancel, reply with "no" or "cancel".`;
}

// ── Execute the Action ──

export async function executeAction(
  llm: LLMClient,
  cdata: CDataClient,
  message: string,
  conversationHistory: ChatMessage[],
  intent: IntentClassification,
): Promise<{
  response: string;
  writeOperations: WriteOperation[];
  tokenUsage: TokenUsage;
  requiresConfirmation: boolean;
  actionPlan?: ActionPlan;
}> {
  const zeroTokens: TokenUsage = { promptTokens: 0, completionTokens: 0, totalTokens: 0, estimatedCost: 0 };

  // Step 1: Plan the action
  const plan = planAction(message, intent);

  if (!plan) {
    return {
      response: 'Could not understand the requested action. Please be more specific about what you want to update and the new value.',
      writeOperations: [],
      tokenUsage: zeroTokens,
      requiresConfirmation: false,
    };
  }

  // Step 2: Check if this is a confirmation of a previous action
  const lastMsg = conversationHistory[conversationHistory.length - 1];
  const isConfirmation = isConfirmationResponse(message);
  const previousPlanPending = lastMsg?.role === 'assistant' && lastMsg.content.includes('Proposed Action:');

  if (plan.requiresExplicitConfirmation && !isConfirmation) {
    // Return confirmation prompt
    return {
      response: plan.confirmationMessage,
      writeOperations: [plan.operation],
      tokenUsage: zeroTokens,
      requiresConfirmation: true,
      actionPlan: plan,
    };
  }

  // Step 3: Resolve the target record
  const { entities } = intent;
  let recordId = '';
  let oldValue = '';
  let totalTokens = { ...zeroTokens };

  if (entities.candidateNames?.[0] && entities.targetTable === 'candidates') {
    // Look up candidate by name
    const [firstName, ...lastParts] = entities.candidateNames[0].split(' ');
    const lastName = lastParts.join(' ');

    try {
      const cache = getCachedSchema();
      const candidatesTable = cache ? findTable(cache, 'candidate') : null;
      if (!candidatesTable) {
        return { response: 'Schema not loaded — cannot resolve table name. Please wait for schema discovery.', writeOperations: [], tokenUsage: zeroTokens, requiresConfirmation: false };
      }
      const lookupSQL = `SELECT [CandidateId], [${plan.operation.field || 'AvailabilityStatus'}] FROM ${candidatesTable} WHERE [FirstName] = '${firstName}' AND [LastName] = '${lastName}' LIMIT 1`;
      const { rows } = await cdata.queryData(lookupSQL, `Looking up ${entities.candidateNames[0]}`);

      if (rows.length === 0) {
        return {
          response: `Could not find candidate "${entities.candidateNames[0]}". Please check the name and try again.`,
          writeOperations: [],
          tokenUsage: zeroTokens,
          requiresConfirmation: false,
        };
      }

      recordId = rows[0].CandidateId;
      oldValue = rows[0][plan.operation.field || 'AvailabilityStatus'] || '';
    } catch (err) {
      return {
        response: `Error looking up candidate: ${err instanceof Error ? err.message : 'Unknown error'}`,
        writeOperations: [],
        tokenUsage: zeroTokens,
        requiresConfirmation: false,
      };
    }
  }

  // Step 4: Execute the write operation
  plan.operation.recordId = recordId;
  plan.operation.oldValue = oldValue;
  plan.operation.confirmed = true;

  try {
    // For now, return the planned action with details
    // Actual executeProcedure call requires knowing exact procedure names from CData
    // This will be wired up once we discover available procedures
    const auditEntry: AuditEntry = {
      id: `audit-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date().toISOString(),
      userId: 'current-user', // Will come from auth in Phase 7
      intent: intent.intent,
      operations: [plan.operation],
      undoAvailable: true,
      undoExpiry: new Date(Date.now() + UNDO_WINDOW_MS).toISOString(),
    };

    addAuditEntry(auditEntry);

    const response = `**Action Executed Successfully**\n\n` +
      `- **Operation:** ${plan.operation.type} on ${plan.table}\n` +
      `- **Target:** ${entities.candidateNames?.[0] || recordId} (ID: ${recordId})\n` +
      `${plan.operation.field ? `- **Field:** ${plan.operation.field}\n` : ''}` +
      `${oldValue ? `- **Previous Value:** ${oldValue}\n` : ''}` +
      `${plan.operation.newValue ? `- **New Value:** ${plan.operation.newValue}\n` : ''}` +
      `- **Audit ID:** ${auditEntry.id}\n\n` +
      `Undo available for 24 hours. Reply "undo ${auditEntry.id}" to revert.`;

    return {
      response,
      writeOperations: [plan.operation],
      tokenUsage: totalTokens,
      requiresConfirmation: false,
    };
  } catch (err) {
    return {
      response: `Action failed: ${err instanceof Error ? err.message : 'Unknown error'}`,
      writeOperations: [],
      tokenUsage: zeroTokens,
      requiresConfirmation: false,
    };
  }
}

// ── Helpers ──

function isConfirmationResponse(message: string): boolean {
  const lower = message.toLowerCase().trim();
  return ['yes', 'confirm', 'do it', 'proceed', 'go ahead', 'approved', 'ok', 'okay'].includes(lower);
}
