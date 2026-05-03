// Intent Router - Classifies user queries without LLM calls (keyword-based, fast, free)
// Routes to: search | analyze | action | bulk | chain | chat

import { Intent, IntentClassification, ParsedEntities } from './types';

// ── Keyword Dictionaries ──

const SEARCH_KEYWORDS = [
  'find', 'show', 'list', 'search', 'get', 'who', 'which', 'what',
  'display', 'fetch', 'look up', 'lookup', 'pull up', 'pull',
  'candidates', 'jobs', 'requisitions', 'placements', 'clients',
  'available', 'details', 'information', 'how many', 'count',
  'average', 'total', 'salary', 'rate', 'recent', 'active',
];

const ANALYZE_KEYWORDS = [
  'rank', 'score', 'compare', 'match', 'best', 'top', 'fit',
  'gap analysis', 'side by side', 'versus', 'vs', 'evaluate',
  'recommend', 'suggest', 'assess', 'benchmark', 'rate against',
];

const ACTION_KEYWORDS = [
  'update', 'change', 'set', 'move', 'advance', 'reject',
  'withdraw', 'mark', 'log', 'add note', 'record', 'assign',
  'edit', 'modify', 'place', 'archive', 'reactivate',
];

const BULK_KEYWORDS = [
  'all', 'bulk', 'batch', 'every', 'each', 'mass',
  'all candidates', 'all submitted', 'everyone',
  'clean up', 'cleanup', 'pipeline cleanup',
];

const CHAIN_KEYWORDS = [
  'shortlist', 'fill this', 'fill the', 'end of day', 'eod',
  'monday brief', 'weekly report', 'daily standup',
  'tell me everything about', 'candidate 360', 'full profile',
  'pipeline cleanup', 'clean up my pipeline',
  'find and update', 'search and move', 'find and shortlist',
];

const STATUS_VALUES = [
  'active', 'passive', 'placed', 'bench', 'interviewed',
  'submitted', 'offered', 'rejected', 'withdrawn', 'screened',
  'shortlisted', 'inactive', 'archived', 'open', 'closed',
  'filled', 'on hold',
];

const TABLE_KEYWORDS: Record<string, ParsedEntities['targetTable']> = {
  'candidate': 'candidates',
  'candidates': 'candidates',
  'job': 'jobs',
  'jobs': 'jobs',
  'requisition': 'jobs',
  'requisitions': 'jobs',
  'req': 'jobs',
  'reqs': 'jobs',
  'placement': 'placements',
  'placements': 'placements',
  'client': 'clients',
  'clients': 'clients',
  'activity': 'activities',
  'activities': 'activities',
  'skill': 'skills',
  'skills': 'skills',
};

// ── Name Extraction ──

function extractNames(message: string): string[] {
  const names: string[] = [];

  // Pattern: "FirstName LastName" (capitalized words)
  const namePattern = /\b([A-Z][a-z]+)\s+([A-Z][a-z]+)\b/g;
  let match;
  while ((match = namePattern.exec(message)) !== null) {
    const fullName = `${match[1]} ${match[2]}`;
    // Filter out common false positives
    const falsePositives = ['Data Source', 'Job Title', 'Connect AI', 'Google Sheets',
      'Talent Intelligence', 'Last Name', 'First Name', 'Next Steps', 'Key Insights'];
    if (!falsePositives.includes(fullName)) {
      names.push(fullName);
    }
  }

  // Pattern: possessive "'s" (e.g., "John Smith's")
  const possessivePattern = /\b([A-Z][a-z]+)\s+([A-Z][a-z]+)'s\b/g;
  while ((match = possessivePattern.exec(message)) !== null) {
    names.push(`${match[1]} ${match[2]}`);
  }

  return [...new Set(names)];
}

// ── Entity Extraction ──

function extractEntities(message: string): ParsedEntities {
  const lower = message.toLowerCase();
  const entities: ParsedEntities = {};

  // Extract candidate names
  const names = extractNames(message);
  if (names.length > 0) {
    entities.candidateNames = names;
  }

  // Extract target table
  for (const [keyword, table] of Object.entries(TABLE_KEYWORDS)) {
    if (lower.includes(keyword)) {
      entities.targetTable = table;
      break;
    }
  }

  // Extract action verb
  const actionVerbs = ['update', 'change', 'set', 'move', 'advance', 'reject',
    'withdraw', 'mark', 'log', 'add', 'remove', 'assign', 'archive', 'reactivate',
    'place', 'edit', 'modify'];
  for (const verb of actionVerbs) {
    if (lower.includes(verb)) {
      entities.actionVerb = verb;
      break;
    }
  }

  // Extract status values
  for (const status of STATUS_VALUES) {
    if (lower.includes(status)) {
      entities.statuses = entities.statuses || [];
      entities.statuses.push(status);
    }
  }

  // Extract new value for action intents (e.g., "to Active", "as Interviewed")
  const toValuePattern = /\b(?:to|as|into)\s+(\w+)/i;
  const toMatch = message.match(toValuePattern);
  if (toMatch) {
    entities.newValue = toMatch[1];
  }

  // Detect chain type
  if (lower.includes('shortlist') || lower.includes('fill this') || lower.includes('fill the')) {
    entities.chainType = 'fillReq';
  } else if (lower.includes('cleanup') || lower.includes('clean up')) {
    entities.chainType = 'cleanup';
  } else if (lower.includes('monday brief') || lower.includes('weekly') || lower.includes('daily standup')) {
    entities.chainType = 'brief';
  } else if (lower.includes('everything about') || lower.includes('360') || lower.includes('full profile')) {
    entities.chainType = 'candidate360';
  } else if (lower.includes('end of day') || lower.includes('eod')) {
    entities.chainType = 'eod';
  }

  // Detect bulk selector
  if (lower.includes('all ') || lower.includes('every ') || lower.includes('each ')) {
    entities.bulkSelector = 'all';
  } else if (lower.includes('stale') || lower.includes('no activity') || lower.includes('inactive')) {
    entities.bulkSelector = 'stale';
  } else if (lower.includes('uncontacted') || lower.includes('not contacted')) {
    entities.bulkSelector = 'uncontacted';
  }

  return entities;
}

// ── Intent Scoring ──

function scoreIntent(message: string, keywords: string[]): number {
  const lower = message.toLowerCase();
  let matches = 0;

  for (const keyword of keywords) {
    if (lower.includes(keyword)) {
      matches++;
    }
  }

  return matches / Math.max(keywords.length, 1);
}

// ── Main Router ──

export function classifyIntent(message: string): IntentClassification {
  const entities = extractEntities(message);
  const lower = message.toLowerCase();

  // Score each intent
  const scores: Record<Intent, number> = {
    search: scoreIntent(message, SEARCH_KEYWORDS),
    analyze: scoreIntent(message, ANALYZE_KEYWORDS),
    action: scoreIntent(message, ACTION_KEYWORDS),
    bulk: scoreIntent(message, BULK_KEYWORDS),
    chain: scoreIntent(message, CHAIN_KEYWORDS),
    chat: 0,
  };

  // Boost scores based on entity context
  if (entities.chainType) {
    scores.chain += 0.3;
  }

  if (entities.actionVerb && entities.candidateNames?.length === 1) {
    scores.action += 0.25;
  }

  if (entities.actionVerb && entities.bulkSelector) {
    scores.bulk += 0.3;
  }

  if (entities.candidateNames && entities.candidateNames.length > 0 && !entities.actionVerb) {
    scores.search += 0.1;
  }

  // Chain detection: action + bulk together often means chain
  if (scores.action > 0 && scores.search > 0 && entities.chainType) {
    scores.chain += 0.2;
  }

  // Find highest scoring intent
  let bestIntent: Intent = 'chat';
  let bestScore = 0;

  for (const [intent, score] of Object.entries(scores) as [Intent, number][]) {
    if (score > bestScore) {
      bestScore = score;
      bestIntent = intent;
    }
  }

  // If no strong signal, default to search if data-related keywords present
  if (bestScore < 0.02) {
    const hasDataKeywords = SEARCH_KEYWORDS.some(kw => lower.includes(kw));
    if (hasDataKeywords) {
      bestIntent = 'search';
      bestScore = 0.3;
    } else {
      bestIntent = 'chat';
      bestScore = 0.5;
    }
  }

  // Normalize confidence to 0-1
  const confidence = Math.min(bestScore * 5, 1);

  return {
    intent: bestIntent,
    confidence,
    entities,
    originalMessage: message,
  };
}

// ── Debug Helper ──

export function debugIntent(message: string): void {
  const result = classifyIntent(message);
  console.log(`[Intent Router] "${message.substring(0, 50)}..." → ${result.intent} (${(result.confidence * 100).toFixed(0)}%)`);
  if (result.entities.candidateNames) console.log(`  Names: ${result.entities.candidateNames.join(', ')}`);
  if (result.entities.actionVerb) console.log(`  Action: ${result.entities.actionVerb}`);
  if (result.entities.targetTable) console.log(`  Table: ${result.entities.targetTable}`);
  if (result.entities.chainType) console.log(`  Chain: ${result.entities.chainType}`);
}
