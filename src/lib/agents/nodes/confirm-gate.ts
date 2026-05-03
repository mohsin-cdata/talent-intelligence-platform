// LangGraph Node: Confirm Gate (Phase 12c)
//
// Gates mutations by risk level:
// - low: auto-confirm (INSERT)
// - medium+: return with mutationConfirmed=false, UI shows confirmation dialog
//
// When mutationConfirmed is false, the graph stops and returns to the UI.
// The UI can then re-invoke with mutationConfirmed=true after user confirms.

import { TIPAgentState } from '../types';
import { assessRisk } from '../../mutation-manager';

export async function confirmGateNode(
  state: TIPAgentState,
): Promise<Partial<TIPAgentState>> {
  // If already confirmed (re-invocation after user confirmed), pass through
  if (state.mutationConfirmed) {
    console.log('[ConfirmGate] Mutation already confirmed, passing through');
    return {};
  }

  const sql = state.generatedSQL || '';
  const risk = assessRisk(sql);

  console.log(`[ConfirmGate] Risk level: ${risk} for SQL: ${sql.substring(0, 80)}`);

  if (risk === 'low') {
    // Auto-confirm low-risk mutations (INSERTs)
    console.log('[ConfirmGate] Auto-confirming low-risk mutation');
    return { mutationConfirmed: true };
  }

  if (risk === 'destructive') {
    // Block destructive mutations entirely
    console.log('[ConfirmGate] BLOCKING destructive mutation');
    return {
      mutationConfirmed: false,
      analysis: `BLOCKED: This mutation is destructive (${risk}). It would affect all rows. Please add a WHERE clause or be more specific.`,
      errors: [...(state.errors || []), 'Destructive mutation blocked by safety gate'],
    };
  }

  // Medium/high risk: require user confirmation
  const dmlType = sql.trim().split(/\s/)[0].toUpperCase();
  return {
    mutationConfirmed: false,
    analysis: `Confirmation required (${risk} risk): ${dmlType} operation planned. Review the SQL and confirm to proceed.`,
  };
}
