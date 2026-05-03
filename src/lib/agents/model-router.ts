// Model Router - Intelligent model selection based on query complexity
// Routes simple queries to cheap/free models, complex ones to capable models
// Saves tokens and cost without sacrificing quality

import { Intent } from './types';

// ── Complexity Levels ──

export type QueryComplexity = 'simple' | 'moderate' | 'complex';

export interface ModelRecommendation {
  complexity: QueryComplexity;
  reason: string;
  suggestedMaxTokens: number;
  suggestedTemperature: number;
}

// ── Complexity Signals ──

const COMPLEX_SIGNALS = [
  // Multi-step reasoning
  'compare', 'versus', 'vs', 'side by side', 'trade-off', 'trade off',
  // Analysis
  'analyze', 'rank', 'score', 'evaluate', 'assess', 'benchmark',
  // Aggregation
  'trend', 'pattern', 'correlation', 'distribution', 'breakdown',
  // Multi-table
  'join', 'across', 'relationship', 'related', 'linked',
  // Synthesis
  'summarize everything', 'full picture', '360', 'comprehensive',
  'brief', 'report', 'end of day', 'eod',
];

const SIMPLE_SIGNALS = [
  // Direct lookups
  'show', 'list', 'find', 'get', 'who is', 'what is',
  // Counts
  'how many', 'count', 'total',
  // Single filters
  'with status', 'in city', 'named',
  // Simple updates
  'update', 'change', 'set', 'mark',
];

// ── Complexity Assessment ──

export function assessComplexity(message: string, intent: Intent): ModelRecommendation {
  const lower = message.toLowerCase();
  const wordCount = message.split(/\s+/).length;

  let complexScore = 0;
  let simpleScore = 0;

  // Check signals
  for (const signal of COMPLEX_SIGNALS) {
    if (lower.includes(signal)) complexScore++;
  }
  for (const signal of SIMPLE_SIGNALS) {
    if (lower.includes(signal)) simpleScore++;
  }

  // Intent-based adjustments
  switch (intent) {
    case 'chat':
      simpleScore += 2;
      break;
    case 'search':
      simpleScore += 1;
      break;
    case 'analyze':
      complexScore += 2;
      break;
    case 'action':
      // Actions are moderate - need understanding but not deep analysis
      break;
    case 'bulk':
      complexScore += 1;
      break;
    case 'chain':
      complexScore += 3; // Chains are always complex
      break;
  }

  // Message length as complexity proxy
  if (wordCount > 30) complexScore++;
  if (wordCount < 8) simpleScore++;

  // Multiple questions
  if ((message.match(/\?/g) || []).length > 1) complexScore++;

  // Determine complexity
  let complexity: QueryComplexity;
  if (complexScore >= 3 || (complexScore > simpleScore && complexScore >= 2)) {
    complexity = 'complex';
  } else if (complexScore >= 1 && simpleScore <= 2) {
    complexity = 'moderate';
  } else {
    complexity = 'simple';
  }

  // Build recommendation
  const configs: Record<QueryComplexity, { maxTokens: number; temperature: number; reason: string }> = {
    simple: {
      maxTokens: 500,
      temperature: 0.1,
      reason: 'Direct lookup or simple query - minimal tokens needed',
    },
    moderate: {
      maxTokens: 1000,
      temperature: 0.2,
      reason: 'Standard query with some reasoning - balanced token usage',
    },
    complex: {
      maxTokens: 1500,
      temperature: 0.3,
      reason: 'Multi-step analysis or synthesis - higher token budget for quality',
    },
  };

  const config = configs[complexity];

  return {
    complexity,
    reason: config.reason,
    suggestedMaxTokens: config.maxTokens,
    suggestedTemperature: config.temperature,
  };
}

// ── Cost Estimation ──

export function estimateQueryCost(
  complexity: QueryComplexity,
  intent: Intent,
  modelPricePerMToken: { input: number; output: number },
): number {
  // Estimated token usage by complexity and intent
  const tokenEstimates: Record<QueryComplexity, Record<string, { input: number; output: number }>> = {
    simple: {
      search: { input: 800, output: 200 },
      chat: { input: 500, output: 300 },
      action: { input: 600, output: 150 },
      default: { input: 700, output: 250 },
    },
    moderate: {
      search: { input: 1500, output: 500 },
      analyze: { input: 2000, output: 800 },
      action: { input: 1000, output: 300 },
      default: { input: 1500, output: 500 },
    },
    complex: {
      analyze: { input: 3000, output: 1200 },
      chain: { input: 5000, output: 2000 },
      bulk: { input: 2500, output: 800 },
      default: { input: 3000, output: 1000 },
    },
  };

  const estimates = tokenEstimates[complexity];
  const tokens = estimates[intent] || estimates.default;

  return (tokens.input / 1_000_000) * modelPricePerMToken.input +
         (tokens.output / 1_000_000) * modelPricePerMToken.output;
}
