// Search Agent - Handles data queries via CData Connect AI MCP
// Extracted from chat/route.ts for use by the orchestrator

import { CDataClient } from '@/lib/cdata-client';
import { getCachedSchema, buildSchemaPrompt, findTable } from './schema-cache';
import type { CachedSchema } from './types';
import { LLMClient } from '@/lib/openai-client';
import { ChatMessage, TokenUsage } from '@/types';

// ── SQL Query Cache ──

interface CachedQuery {
  sql: string;
  timestamp: number;
}

const SQL_CACHE = new Map<string, CachedQuery>();
const CACHE_MAX_AGE_MS = 15 * 60 * 1000; // 15 minutes
const CACHE_MAX_SIZE = 100;

function normalizeQuery(query: string): string {
  return query.toLowerCase().trim()
    .replace(/\s+/g, ' ')
    .replace(/[?.!,;:'"]/g, '');
}

export function getCachedSQL(query: string): string | null {
  const key = normalizeQuery(query);
  const entry = SQL_CACHE.get(key);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > CACHE_MAX_AGE_MS) {
    SQL_CACHE.delete(key);
    return null;
  }
  return entry.sql;
}

export function setCachedSQL(query: string, sql: string): void {
  if (SQL_CACHE.size >= CACHE_MAX_SIZE) {
    const oldestKey = SQL_CACHE.keys().next().value;
    if (oldestKey) SQL_CACHE.delete(oldestKey);
  }
  SQL_CACHE.set(normalizeQuery(query), { sql, timestamp: Date.now() });
}

export function clearCacheEntry(query: string): void {
  SQL_CACHE.delete(normalizeQuery(query));
}

// ── Schema Builder ──
// Returns schema from cache (REST-discovered, live) if available
// Falls back to a minimal prompt telling the LLM to query INFORMATION_SCHEMA

export function getSchema(lockedTables?: string[]): string {
  const cached = getCachedSchema();
  if (cached) {
    return buildSchemaPrompt(cached, lockedTables);
  }
  // No cache yet — return minimal prompt; schema discovery is async and will populate cache
  return 'Schema not yet loaded. Use INFORMATION_SCHEMA.COLUMNS to discover available tables before querying.';
}

// ── Relational Query Detection ──

export interface RelationalQueryInfo {
  isRelational: boolean;
  firstName?: string;
  lastName?: string;
  targetTable?: 'placements' | 'activities';
  originalQuery: string;
}

function capitalizeFirst(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

export function detectRelationalQuery(message: string): RelationalQueryInfo {
  const possessivePattern = /(\w+)\s+(\w+)'s\s+(placements?|activities?|history)/i;
  const forPattern = /(placements?|activities?|history)\s+for\s+(\w+)\s+(\w+)/i;
  const getPattern = /get\s+(all\s+)?(placements?|activities?)\s+for\s+candidateid\s*=\s*'?([^']+)'?/i;
  const showPattern = /show\s+(\w+)\s+(\w+)'s\s+(placements?|activities?)/i;

  let firstName = '';
  let lastName = '';
  let targetTable: 'placements' | 'activities' | undefined;

  const possessiveMatch = message.match(possessivePattern);
  if (possessiveMatch) {
    firstName = possessiveMatch[1];
    lastName = possessiveMatch[2];
    const entity = possessiveMatch[3].toLowerCase();
    targetTable = entity.startsWith('placement') ? 'placements' : entity.startsWith('activit') ? 'activities' : undefined;
  }

  const forMatch = message.match(forPattern);
  if (forMatch && !possessiveMatch) {
    const entity = forMatch[1].toLowerCase();
    firstName = forMatch[2];
    lastName = forMatch[3];
    targetTable = entity.startsWith('placement') ? 'placements' : entity.startsWith('activit') ? 'activities' : undefined;
  }

  const getMatch = message.match(getPattern);
  if (getMatch) {
    return { isRelational: false, originalQuery: message };
  }

  const showMatch = message.match(showPattern);
  if (showMatch) {
    firstName = showMatch[1];
    lastName = showMatch[2];
    const entity = showMatch[3].toLowerCase();
    targetTable = entity.startsWith('placement') ? 'placements' : entity.startsWith('activit') ? 'activities' : undefined;
  }

  const isRelational = !!(firstName && lastName && targetTable);
  return {
    isRelational,
    firstName: firstName ? capitalizeFirst(firstName) : undefined,
    lastName: lastName ? capitalizeFirst(lastName) : undefined,
    targetTable,
    originalQuery: message,
  };
}

// ── Execute Relational Query ──

export async function executeRelationalQuery(
  info: RelationalQueryInfo,
  cdata: CDataClient
): Promise<{ rows: any[]; sql: string; duration: number }> {
  const startTime = Date.now();

  // Resolve table names dynamically from schema cache
  const cache = getCachedSchema();
  const candidatesTable = cache ? findTable(cache, 'candidate') : null;
  const placementsTable = cache ? findTable(cache, 'placement') : null;
  const activitiesTable = cache ? findTable(cache, 'activit') : null;

  if (!candidatesTable) {
    return { rows: [], sql: '', duration: Date.now() - startTime };
  }

  const candidateLookupSQL = `SELECT [CandidateId], [FirstName], [LastName] FROM ${candidatesTable} WHERE [FirstName] = '${info.firstName}' AND [LastName] = '${info.lastName}'`;

  const candidateResult = await cdata.queryData(candidateLookupSQL, `Looking up CandidateId for ${info.firstName} ${info.lastName}`);

  if (!candidateResult.rows || candidateResult.rows.length === 0) {
    return { rows: [], sql: candidateLookupSQL, duration: Date.now() - startTime };
  }

  const candidateId = candidateResult.rows[0].CandidateId;
  let relatedSQL = '';

  if (info.targetTable === 'placements' && placementsTable) {
    relatedSQL = `SELECT * FROM ${placementsTable} WHERE [CandidateId] = '${candidateId}' ORDER BY [StartDate] DESC LIMIT 50`;
  } else if (info.targetTable === 'activities' && activitiesTable) {
    relatedSQL = `SELECT * FROM ${activitiesTable} WHERE [CandidateId] = '${candidateId}' ORDER BY [ActivityDate] DESC LIMIT 50`;
  }

  const relatedResult = await cdata.queryData(relatedSQL, `Getting ${info.targetTable} for ${info.firstName} ${info.lastName}`);

  return {
    rows: relatedResult.rows,
    sql: `-- Step 1: Find CandidateId\n${candidateLookupSQL}\n\n-- Step 2: Get ${info.targetTable}\n${relatedSQL}`,
    duration: Date.now() - startTime,
  };
}

// ── Agent Loop (SQL generation + execution) ──

export async function runAgentLoop(
  openai: LLMClient,
  cdata: CDataClient,
  userMessage: string,
  schema: string,
  conversationHistory: ChatMessage[],
  maxIterations: number = 3
): Promise<{
  results: any[];
  sql: string;
  duration: number;
  error: string | null;
  tokenUsage: TokenUsage;
}> {
  const startTime = Date.now();
  let allResults: any[] = [];
  let allSQL: string[] = [];
  let error: string | null = null;
  let totalTokens: TokenUsage = { promptTokens: 0, completionTokens: 0, totalTokens: 0, estimatedCost: 0 };

  // Check SQL cache first
  const cachedSQL = getCachedSQL(userMessage);

  try {
    let sql: string;

    if (cachedSQL) {
      console.log('[Search Agent] Cache HIT - skipping LLM SQL generation');
      sql = cachedSQL;
    } else {
      const { sql: generatedSQL, explanation, tokenUsage: sqlTokens } = await openai.generateSQL(
        userMessage,
        schema,
        conversationHistory
      );

      totalTokens = {
        promptTokens: totalTokens.promptTokens + sqlTokens.promptTokens,
        completionTokens: totalTokens.completionTokens + sqlTokens.completionTokens,
        totalTokens: totalTokens.totalTokens + sqlTokens.totalTokens,
        estimatedCost: totalTokens.estimatedCost + sqlTokens.estimatedCost,
      };

      if (!generatedSQL) {
        return {
          results: [],
          sql: '',
          duration: Date.now() - startTime,
          error: 'Could not generate SQL for this query',
          tokenUsage: totalTokens,
        };
      }

      sql = generatedSQL;
      setCachedSQL(userMessage, sql);
    }

    allSQL.push(sql);
    console.log('[Search Agent] Executing SQL:', sql);

    const { rows, duration } = await cdata.queryData(sql, userMessage);
    console.log('[Search Agent] Query returned', rows.length, 'rows in', duration, 'ms');
    allResults = rows;
  } catch (err) {
    clearCacheEntry(userMessage);
    error = err instanceof Error ? err.message : 'Query execution failed';
    console.error('[Search Agent] Error:', err);
  }

  return {
    results: allResults,
    sql: allSQL.join('\n\n'),
    duration: Date.now() - startTime,
    error,
    tokenUsage: totalTokens,
  };
}
