// LangGraph Node: Executor
// Executes SQL via REST POST /query and returns results
// Phase 12: Routes mutations through mutate() (bypasses dedup cache, stricter limits)
// Phase 13: Federated queries get longer timeout (15s vs 10s)

import { TIPAgentState } from '../types';
import { getRestClient } from '../../cdata-rest-client';
import { isMutation } from '../../rate-limiter';

// Detect if SQL references multiple catalogs (federated query)
function isFederatedSQL(sql: string): boolean {
  // Count distinct [CatalogName]. patterns
  const catalogRefs = sql.match(/\[([^\]]+)\]\.\[([^\]]+)\]\.\[([^\]]+)\]/g) || [];
  const catalogs = new Set(catalogRefs.map(ref => ref.split('].')[0] + ']'));
  return catalogs.size > 1;
}

const SINGLE_SOURCE_TIMEOUT = 10_000;
const FEDERATED_TIMEOUT = 15_000;

export async function executorNode(
  state: TIPAgentState,
): Promise<Partial<TIPAgentState>> {
  if (!state.generatedSQL) {
    return {
      errors: [...(state.errors || []), 'No SQL to execute'],
      queryResults: [],
    };
  }

  try {
    const rest = getRestClient();
    const sql = state.generatedSQL;
    const federated = isFederatedSQL(sql) || (state.lockedSources?.length || 0) > 1;

    // Route mutations through mutate() (stricter rate limits, audit ledger, no dedup cache)
    if (isMutation(sql)) {
      console.log(`[Executor] Mutation detected, using mutate() path`);
      const result = await rest.mutate(sql, 'LangGraph mutation executor');

      if (!result.success) {
        return {
          errors: [...(state.errors || []), `Mutation failed: ${result.error}`],
          queryResults: [],
          analysis: `Mutation failed: ${result.error}`,
        };
      }

      console.log(`[Executor] Mutation: ${result.rowsAffected} rows affected in ${result.duration}ms`);
      return {
        queryResults: [{ rowsAffected: result.rowsAffected, success: true }],
        analysis: `Successfully executed mutation. ${result.rowsAffected} row(s) affected.`,
      };
    }

    // Read path
    if (federated) {
      console.log(`[Executor] Federated query across ${state.lockedSources?.length || '?'} sources (${FEDERATED_TIMEOUT / 1000}s timeout)`);
    }

    // Use appropriate timeout
    const timeoutMs = federated ? FEDERATED_TIMEOUT : SINGLE_SOURCE_TIMEOUT;

    // Race query against timeout
    const queryPromise = rest.query(sql, federated ? 'Federated query' : 'LangGraph executor');
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error(
        federated
          ? `Federated query timed out after ${timeoutMs / 1000}s. Try simplifying to a single source or narrowing the query.`
          : `Query timed out after ${timeoutMs / 1000}s.`
      )), timeoutMs);
    });

    const result = await Promise.race([queryPromise, timeoutPromise]);

    if (federated) {
      console.log(`[Executor] Federated: ${result.rowCount} rows in ${result.duration}ms`);
    } else {
      console.log(`[Executor] ${result.rowCount} rows in ${result.duration}ms`);
    }

    return {
      queryResults: result.rows,
    };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : 'Unknown error';
    const isFed = isFederatedSQL(state.generatedSQL) || (state.lockedSources?.length || 0) > 1;

    // Enhanced error message for federated queries
    let userMsg = `Execution failed: ${errorMsg}`;
    if (isFed && errorMsg.includes('timed out')) {
      userMsg = `Federated query timed out. The query spans multiple data sources which can be slower. Try:\n- Simplifying to a single source\n- Adding more specific filters\n- Reducing the number of columns`;
    }

    console.error(`[Executor] ${userMsg}`);
    return {
      errors: [...(state.errors || []), userMsg],
      queryResults: [],
    };
  }
}
