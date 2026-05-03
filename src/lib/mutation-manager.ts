// Mutation Manager (Phase 12b)
//
// Handles the full mutation lifecycle:
// 1. Optimistic update (immediately update Zustand state)
// 2. Background execution (fire SQL mutation via REST)
// 3. Success -> confirm, audit log, success toast
// 4. Failure -> rollback Zustand, error toast with [Retry] [Undo]
// 5. Timeout (10s) -> "Still processing..." with [Cancel]

import { getRestClient } from './cdata-rest-client';

// ── Types ──

export type MutationStatus = 'pending' | 'executing' | 'success' | 'failed' | 'timeout' | 'cancelled';

export type RiskLevel = 'low' | 'medium' | 'high' | 'destructive';

export interface PendingMutation {
  id: string;
  sql: string;
  description: string;
  table: string;
  recordId: string;
  field?: string;
  oldValue?: string;
  newValue?: string;
  status: MutationStatus;
  riskLevel: RiskLevel;
  createdAt: number;
  resolvedAt?: number;
  error?: string;
  rowsAffected?: number;
  // For optimistic rollback
  rollbackFn?: () => void;
}

export interface MutationResult {
  success: boolean;
  rowsAffected: number;
  duration: number;
  error?: string;
}

// ── Risk Assessment ──

export function assessRisk(sql: string): RiskLevel {
  const upper = sql.trim().toUpperCase();

  // Destructive: DELETE without WHERE, DROP, TRUNCATE
  if (upper.startsWith('DELETE ') && !upper.includes('WHERE')) return 'destructive';
  if (upper.startsWith('DROP ') || upper.startsWith('TRUNCATE ')) return 'destructive';

  // High: DELETE with WHERE, bulk UPDATE
  if (upper.startsWith('DELETE ')) return 'high';
  if (upper.startsWith('UPDATE ') && !upper.includes('WHERE')) return 'destructive';

  // Medium: UPDATE (targeted)
  if (upper.startsWith('UPDATE ')) return 'medium';

  // Low: INSERT
  if (upper.startsWith('INSERT ')) return 'low';

  return 'medium';
}

// ── DML type detection ──

export function detectDMLType(sql: string): 'update' | 'insert' | 'delete' {
  const upper = sql.trim().toUpperCase();
  if (upper.startsWith('UPDATE ')) return 'update';
  if (upper.startsWith('INSERT ')) return 'insert';
  if (upper.startsWith('DELETE ')) return 'delete';
  return 'update'; // default
}

// ── Table extraction from SQL ──

export function extractTable(sql: string): string {
  const upper = sql.trim().toUpperCase();

  // UPDATE [Catalog].[Schema].[Table] SET ...
  let match = sql.match(/UPDATE\s+(\[?[^\s\[]+\]?\.?\[?[^\s\[]*\]?\.?\[?[^\s\[]*\]?)\s/i);
  if (match) return match[1];

  // INSERT INTO [Catalog].[Schema].[Table] ...
  match = sql.match(/INSERT\s+INTO\s+(\[?[^\s\[]+\]?\.?\[?[^\s\[]*\]?\.?\[?[^\s\[]*\]?)/i);
  if (match) return match[1];

  // DELETE FROM [Catalog].[Schema].[Table] ...
  match = sql.match(/DELETE\s+FROM\s+(\[?[^\s\[]+\]?\.?\[?[^\s\[]*\]?\.?\[?[^\s\[]*\]?)/i);
  if (match) return match[1];

  return 'unknown';
}

// ── Mutation execution ──

const MUTATION_TIMEOUT_MS = 10_000;

export async function executeMutation(mutation: PendingMutation): Promise<MutationResult> {
  const rest = getRestClient();

  // Race mutation against timeout
  const mutationPromise = rest.mutate(mutation.sql, mutation.description);

  const timeoutPromise = new Promise<MutationResult>((resolve) => {
    setTimeout(() => {
      resolve({ success: false, rowsAffected: 0, duration: MUTATION_TIMEOUT_MS, error: 'Mutation timed out (10s)' });
    }, MUTATION_TIMEOUT_MS);
  });

  return Promise.race([mutationPromise, timeoutPromise]);
}

// ── Unique ID generator ──

export function generateMutationId(): string {
  return `mut-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
}

// ── Extract catalog from fully qualified table name ──

export function extractCatalog(fqTable: string): string | null {
  // [Catalog].[Schema].[Table] -> Catalog
  const match = fqTable.match(/^\[?([^\].\s]+)\]?\./);
  return match ? match[1] : null;
}

// ── Check if mutation targets a writable source ──
// Phase 13d: federated queries are read-only; only single-source mutations are allowed

export function validateMutationTarget(
  sql: string,
  writableCatalogs: string[],
): { valid: boolean; error?: string } {
  const table = extractTable(sql);
  if (table === 'unknown') {
    return { valid: false, error: 'Could not determine target table from SQL' };
  }

  const catalog = extractCatalog(table);
  if (!catalog) {
    return { valid: false, error: 'Could not determine catalog from target table' };
  }

  // Check if multiple catalogs are referenced (federated mutation = not allowed)
  const allRefs = sql.match(/\[([^\]]+)\]\.\[([^\]]+)\]\.\[([^\]]+)\]/g) || [];
  const catalogs = new Set(allRefs.map(ref => {
    const m = ref.match(/^\[([^\]]+)\]/);
    return m ? m[1] : '';
  }).filter(Boolean));

  if (catalogs.size > 1) {
    return { valid: false, error: 'Cross-catalog mutations are not supported. Mutations must target a single source.' };
  }

  if (writableCatalogs.length > 0 && !writableCatalogs.includes(catalog)) {
    return { valid: false, error: `Source "${catalog}" is read-only. Cannot execute mutations against it.` };
  }

  return { valid: true };
}

// ── Build mutation from inline edit ──

export function buildUpdateSQL(
  fullyQualifiedTable: string,
  field: string,
  newValue: string,
  idField: string,
  idValue: string,
): string {
  // Escape single quotes in values
  const escaped = newValue.replace(/'/g, "''");
  const escapedId = idValue.replace(/'/g, "''");
  return `UPDATE ${fullyQualifiedTable} SET [${field}] = '${escaped}' WHERE [${idField}] = '${escapedId}'`;
}
