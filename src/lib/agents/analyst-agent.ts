// Analyst Agent - Scores, ranks, compares, and evaluates data
// Handles "analyze" intents: best fit, gap analysis, benchmarking, recommendations
// Uses gatherer for data retrieval, then LLM for structured analysis

import { LLMClient } from '@/lib/openai-client';
import { CDataClient } from '@/lib/cdata-client';
import { ChatMessage, TokenUsage } from '@/types';
import { gatherData } from './gatherer-agent';

// ── Analysis Types ──

export type AnalysisType = 'rank' | 'compare' | 'match' | 'gap' | 'benchmark' | 'recommend';

export interface AnalysisResult {
  type: AnalysisType;
  response: string;
  sql: string;
  results: any[];
  duration: number;
  tokenUsage: TokenUsage;
}

// ── Detect Analysis Type ──

export function detectAnalysisType(message: string): AnalysisType {
  const lower = message.toLowerCase();

  if (lower.includes('compare') || lower.includes('side by side') || lower.includes('versus') || lower.includes(' vs ')) {
    return 'compare';
  }
  if (lower.includes('match') || lower.includes('fit') || lower.includes('suitable')) {
    return 'match';
  }
  if (lower.includes('gap') || lower.includes('missing') || lower.includes('lacking')) {
    return 'gap';
  }
  if (lower.includes('benchmark') || lower.includes('market rate') || lower.includes('average rate')) {
    return 'benchmark';
  }
  if (lower.includes('recommend') || lower.includes('suggest')) {
    return 'recommend';
  }
  // Default: rank/score
  return 'rank';
}

// ── Analysis Prompts ──

function buildAnalysisPrompt(type: AnalysisType, userMessage: string, data: any[], sql: string): string {
  const dataPreview = data.slice(0, 20);
  const dataStr = JSON.stringify(dataPreview, null, 0).substring(0, 3000);

  const baseContext = `User asked: "${userMessage}"
SQL executed: ${sql}
${data.length} rows returned (showing ${dataPreview.length}):
${dataStr}`;

  switch (type) {
    case 'rank':
      return `You are a talent analytics expert. Rank and score the candidates/records below.

${baseContext}

Provide a structured analysis:
1. **Ranked Results** - Order by relevance with a score (1-10) and brief justification
2. **Top Pick** - Your #1 recommendation and why
3. **Key Differentiators** - What separates the top candidates from the rest
4. **Considerations** - Any trade-offs or things to watch for

Use **bold** for names and key metrics. Format as Markdown.`;

    case 'compare':
      return `You are a talent analytics expert. Compare the candidates/records side by side.

${baseContext}

Provide a structured comparison:
1. **Comparison Table** - Key attributes side by side (use a markdown table)
2. **Strengths** - What each candidate/record excels at
3. **Weaknesses** - Where each falls short
4. **Verdict** - Which is the better fit and under what conditions

Use **bold** for names. Format as Markdown.`;

    case 'match':
      return `You are a talent matching expert. Evaluate how well the candidates match the requirements.

${baseContext}

Provide a structured match analysis:
1. **Match Scores** - Each candidate with a percentage match score
2. **Requirements Met** - Which requirements each candidate satisfies
3. **Gaps** - Requirements not met by each candidate
4. **Best Match** - Your recommendation with reasoning

Use **bold** for names. Format as Markdown.`;

    case 'gap':
      return `You are a talent analytics expert. Identify gaps in skills, experience, or coverage.

${baseContext}

Provide a structured gap analysis:
1. **Current Coverage** - What skills/areas are well-covered
2. **Identified Gaps** - Specific gaps with severity (Critical/High/Medium/Low)
3. **Impact** - How each gap affects operations
4. **Recommendations** - How to address each gap (hire, train, redistribute)

Format as Markdown.`;

    case 'benchmark':
      return `You are a market intelligence analyst. Benchmark the data against industry standards.

${baseContext}

Provide a structured benchmark:
1. **Key Metrics** - Rates, experience levels, skill distribution
2. **Market Position** - Above/at/below market for each metric
3. **Competitive Insights** - What stands out positively or negatively
4. **Recommendations** - Rate adjustments or positioning changes

Format as Markdown with numbers and comparisons.`;

    case 'recommend':
      return `You are a talent strategy advisor. Provide actionable recommendations.

${baseContext}

Provide structured recommendations:
1. **Top Recommendations** - 3-5 prioritized actions
2. **Quick Wins** - Changes with immediate impact
3. **Strategic Moves** - Longer-term improvements
4. **Data-Driven Insights** - Patterns in the data that inform your suggestions

Format as Markdown. Be specific and actionable.`;
  }
}

// ── Main Analyst Function ──

export async function analyzeData(
  llm: LLMClient,
  cdata: CDataClient,
  userMessage: string,
  conversationHistory: ChatMessage[],
  lockedTables?: string[],
): Promise<AnalysisResult> {
  const startTime = Date.now();
  let totalTokens: TokenUsage = {
    promptTokens: 0,
    completionTokens: 0,
    totalTokens: 0,
    estimatedCost: 0,
  };

  // Step 1: Detect analysis type
  const analysisType = detectAnalysisType(userMessage);
  console.log(`[Analyst] Analysis type: ${analysisType}`);

  // Step 2: Gather data using the gatherer agent
  const gathered = await gatherData(llm, cdata, userMessage, conversationHistory, lockedTables);

  totalTokens = {
    promptTokens: totalTokens.promptTokens + gathered.tokenUsage.promptTokens,
    completionTokens: totalTokens.completionTokens + gathered.tokenUsage.completionTokens,
    totalTokens: totalTokens.totalTokens + gathered.tokenUsage.totalTokens,
    estimatedCost: totalTokens.estimatedCost + gathered.tokenUsage.estimatedCost,
  };

  if (gathered.error && gathered.results.length === 0) {
    return {
      type: analysisType,
      response: `Could not gather data for analysis: ${gathered.error}`,
      sql: gathered.sql,
      results: [],
      duration: Date.now() - startTime,
      tokenUsage: totalTokens,
    };
  }

  // Step 3: Run analysis LLM call with structured prompt
  const analysisPrompt = buildAnalysisPrompt(analysisType, userMessage, gathered.results, gathered.sql);

  try {
    const response = await llm.rawCompletion(
      [
        { role: 'system', content: 'You are a senior talent intelligence analyst. Provide structured, data-driven analysis in Markdown format. Be concise but thorough.' },
        { role: 'user', content: analysisPrompt },
      ],
      { temperature: 0.4, maxTokens: 1500 },
    );

    totalTokens = {
      promptTokens: totalTokens.promptTokens + response.promptTokens,
      completionTokens: totalTokens.completionTokens + response.completionTokens,
      totalTokens: totalTokens.totalTokens + response.promptTokens + response.completionTokens,
      estimatedCost: totalTokens.estimatedCost + response.estimatedCost,
    };

    console.log(`[Analyst] Analysis complete. Type: ${analysisType}, tokens: ${totalTokens.totalTokens}`);

    return {
      type: analysisType,
      response: response.content,
      sql: gathered.sql,
      results: gathered.results,
      duration: Date.now() - startTime,
      tokenUsage: totalTokens,
    };
  } catch (error) {
    console.error('[Analyst] Analysis LLM call failed:', error);

    // Return gathered data with error note
    return {
      type: analysisType,
      response: `Data gathered but analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}. Raw data is available in the results.`,
      sql: gathered.sql,
      results: gathered.results,
      duration: Date.now() - startTime,
      tokenUsage: totalTokens,
    };
  }
}
