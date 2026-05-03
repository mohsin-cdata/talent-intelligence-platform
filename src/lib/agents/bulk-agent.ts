// Bulk Agent - Handles batch operations on multiple records
// Pattern: Gather targets -> Preview -> Confirm -> Execute batch -> Report
// Safety: Always previews affected records, requires explicit confirmation

import { CDataClient } from '@/lib/cdata-client';
import { getCachedSchema, findTable } from './schema-cache';
import { LLMClient } from '@/lib/openai-client';
import { ChatMessage, TokenUsage } from '@/types';
import { WriteOperation, IntentClassification } from './types';
import { gatherData } from './gatherer-agent';

// ── Bulk Operation Types ──

export interface BulkPlan {
  selector: string;          // "all stale", "uncontacted", etc.
  action: string;            // "update", "archive", "move"
  table: string;
  field?: string;
  newValue?: string;
  affectedCount: number;
  previewRecords: any[];
  confirmationMessage: string;
}

export interface BulkResult {
  response: string;
  plan?: BulkPlan;
  writeOperations: WriteOperation[];
  tokenUsage: TokenUsage;
  requiresConfirmation: boolean;
}

// ── Build Bulk Query ──

function buildBulkQuery(intent: IntentClassification): string | null {
  const { entities } = intent;
  const table = entities.targetTable || 'candidates';
  const selector = entities.bulkSelector || 'all';
  const verb = entities.actionVerb || 'update';

  // Build WHERE clause based on selector
  let whereClause = '';
  switch (selector) {
    case 'stale':
      if (table === 'candidates') {
        whereClause = "[LastContactDate] < DATEADD(day, -30, GETDATE()) OR [LastContactDate] IS NULL";
      } else if (table === 'jobs') {
        whereClause = "[Status] = 'Open' AND [PostedDate] < DATEADD(day, -60, GETDATE())";
      }
      break;
    case 'uncontacted':
      whereClause = "[LastContactDate] IS NULL AND [AvailabilityStatus] IN ('Active', 'Bench')";
      break;
    case 'inactive':
      whereClause = "[AvailabilityStatus] = 'Passive' AND [LastContactDate] < DATEADD(day, -90, GETDATE())";
      break;
    case 'all':
    default:
      // For "all", use status filters to avoid touching everything blindly
      if (entities.statuses?.length) {
        whereClause = entities.statuses.map(s => `[AvailabilityStatus] = '${s}'`).join(' OR ');
      } else {
        whereClause = "1=1"; // will be limited by LIMIT
      }
      break;
  }

  const cache = getCachedSchema();
  const tableName = cache ? findTable(cache, table) : null;
  if (!tableName) return null;

  return `SELECT * FROM ${tableName} WHERE ${whereClause} LIMIT 50`;
}

// ── Execute Bulk Operation ──

export async function executeBulk(
  llm: LLMClient,
  cdata: CDataClient,
  message: string,
  conversationHistory: ChatMessage[],
  intent: IntentClassification,
): Promise<BulkResult> {
  const zeroTokens: TokenUsage = { promptTokens: 0, completionTokens: 0, totalTokens: 0, estimatedCost: 0 };
  const { entities } = intent;

  // Step 1: Gather affected records
  console.log('[Bulk] Gathering affected records');

  const gathered = await gatherData(llm, cdata, message, conversationHistory);

  if (gathered.error && gathered.results.length === 0) {
    return {
      response: `Could not identify records for bulk operation: ${gathered.error}`,
      writeOperations: [],
      tokenUsage: gathered.tokenUsage,
      requiresConfirmation: false,
    };
  }

  const affectedRecords = gathered.results;
  const previewRecords = affectedRecords.slice(0, 5);
  const verb = entities.actionVerb || 'update';
  const table = entities.targetTable || 'candidates';
  const newValue = entities.newValue || '';
  const selector = entities.bulkSelector || 'selected';

  // Step 2: Build preview
  const plan: BulkPlan = {
    selector,
    action: verb,
    table,
    field: inferBulkField(verb, newValue, table),
    newValue: newValue || undefined,
    affectedCount: affectedRecords.length,
    previewRecords,
    confirmationMessage: '',
  };

  // Build the confirmation message
  const previewLines = previewRecords.map((r, i) => {
    const name = r.FirstName && r.LastName ? `**${r.FirstName} ${r.LastName}**` :
                 r.JobTitle ? `**${r.JobTitle}**` :
                 r.CompanyName ? `**${r.CompanyName}**` :
                 `Record ${i + 1}`;
    const status = r.AvailabilityStatus || r.Status || '';
    return `  ${i + 1}. ${name}${status ? ` (${status})` : ''}`;
  }).join('\n');

  plan.confirmationMessage = `**Bulk Operation Preview**\n\n` +
    `- **Action:** ${verb} ${plan.field || 'records'}${newValue ? ` to "${newValue}"` : ''}\n` +
    `- **Affected Records:** ${affectedRecords.length} ${table}\n` +
    `- **Selector:** ${selector}\n\n` +
    `**Preview (first ${previewRecords.length}):**\n${previewLines}\n` +
    `${affectedRecords.length > 5 ? `\n...and ${affectedRecords.length - 5} more\n` : ''}\n` +
    `To confirm, reply "yes" or "confirm". To cancel, reply "no" or "cancel".`;

  // Step 3: Check if user is confirming a previous bulk action
  const isConfirmation = isConfirmationResponse(message);

  if (!isConfirmation) {
    // Return preview for confirmation
    return {
      response: plan.confirmationMessage,
      plan,
      writeOperations: [],
      tokenUsage: gathered.tokenUsage,
      requiresConfirmation: true,
    };
  }

  // Step 4: Execute bulk (create write operations)
  const writeOps: WriteOperation[] = affectedRecords.map(record => ({
    type: 'update' as const,
    table,
    recordId: record.CandidateId || record.ReqId || record.PlacementId || record.ClientId || '',
    field: plan.field,
    oldValue: record[plan.field || ''] || undefined,
    newValue: plan.newValue,
    timestamp: new Date().toISOString(),
    confirmed: true,
  }));

  const successCount = writeOps.length;
  const response = `**Bulk Operation Complete**\n\n` +
    `- **Action:** ${verb}${plan.field ? ` ${plan.field}` : ''}${newValue ? ` to "${newValue}"` : ''}\n` +
    `- **Records Processed:** ${successCount}/${affectedRecords.length}\n` +
    `- **Status:** All operations queued\n\n` +
    `Undo available for 24 hours for all ${successCount} operations.`;

  return {
    response,
    plan,
    writeOperations: writeOps,
    tokenUsage: gathered.tokenUsage,
    requiresConfirmation: false,
  };
}

// ── Helpers ──

function inferBulkField(verb: string, newValue: string, table: string): string | undefined {
  const lower = (newValue || '').toLowerCase();

  if (['move', 'advance', 'reject', 'archive', 'reactivate'].includes(verb)) {
    if (table === 'candidates') return 'AvailabilityStatus';
    if (table === 'jobs') return 'Status';
    if (table === 'placements') return 'Status';
  }

  const candidateStatuses = ['active', 'passive', 'placed', 'bench'];
  const jobStatuses = ['open', 'filled', 'closed', 'on hold'];
  if (candidateStatuses.includes(lower)) return 'AvailabilityStatus';
  if (jobStatuses.includes(lower)) return 'Status';

  return undefined;
}

function isConfirmationResponse(message: string): boolean {
  const lower = message.toLowerCase().trim();
  return ['yes', 'confirm', 'do it', 'proceed', 'go ahead', 'approved', 'ok', 'okay'].includes(lower);
}
