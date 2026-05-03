// Chain Agent - Multi-step autonomous workflows
// Chains: fillReq, cleanup, brief, candidate360, eod
// Each chain orchestrates gatherer + analyst + action in sequence

import { CDataClient } from '@/lib/cdata-client';
import { LLMClient } from '@/lib/openai-client';
import { ChatMessage, TokenUsage } from '@/types';
import { IntentClassification } from './types';
import { gatherData } from './gatherer-agent';
import { analyzeData } from './analyst-agent';

// ── Chain Types ──

export type ChainType = 'fillReq' | 'cleanup' | 'brief' | 'candidate360' | 'eod';

export interface ChainStep {
  name: string;
  status: 'pending' | 'running' | 'done' | 'failed';
  result?: string;
  duration?: number;
}

export interface ChainResult {
  type: ChainType;
  response: string;
  steps: ChainStep[];
  sql: string;
  results: any[];
  duration: number;
  tokenUsage: TokenUsage;
}

// ── Token Accumulator ──

function addTokens(a: TokenUsage, b: TokenUsage): TokenUsage {
  return {
    promptTokens: a.promptTokens + b.promptTokens,
    completionTokens: a.completionTokens + b.completionTokens,
    totalTokens: a.totalTokens + b.totalTokens,
    estimatedCost: a.estimatedCost + b.estimatedCost,
  };
}

const ZERO_TOKENS: TokenUsage = { promptTokens: 0, completionTokens: 0, totalTokens: 0, estimatedCost: 0 };

// ── Chain: Fill Requisition ──

async function runFillReq(
  llm: LLMClient, cdata: CDataClient, message: string, history: ChatMessage[], lockedTables?: string[],
): Promise<ChainResult> {
  const startTime = Date.now();
  const steps: ChainStep[] = [];
  let totalTokens = { ...ZERO_TOKENS };
  let allSQL: string[] = [];
  let allResults: any[] = [];

  // Step 1: Gather job requirements
  steps.push({ name: 'Gather job requirements', status: 'running' });
  const jobQuery = message.includes('req') || message.includes('job')
    ? message
    : `Show open job requisitions with required skills`;

  const jobData = await gatherData(llm, cdata, jobQuery, history, lockedTables);
  totalTokens = addTokens(totalTokens, jobData.tokenUsage);
  steps[0].status = jobData.error ? 'failed' : 'done';
  steps[0].duration = jobData.duration;
  if (jobData.sql) allSQL.push(jobData.sql);

  if (jobData.results.length === 0) {
    return {
      type: 'fillReq',
      response: 'Could not find any open job requisitions to fill. Try specifying a job title or req ID.',
      steps,
      sql: allSQL.join('\n\n'),
      results: [],
      duration: Date.now() - startTime,
      tokenUsage: totalTokens,
    };
  }

  // Step 2: Search matching candidates
  steps.push({ name: 'Search matching candidates', status: 'running' });
  const job = jobData.results[0];
  const skills = job.RequiredSkills || job.Skills || '';
  const candidateQuery = `Find active candidates with skills matching: ${skills}`;

  const candidateData = await gatherData(llm, cdata, candidateQuery, history, lockedTables);
  totalTokens = addTokens(totalTokens, candidateData.tokenUsage);
  steps[1].status = candidateData.error ? 'failed' : 'done';
  steps[1].duration = candidateData.duration;
  if (candidateData.sql) allSQL.push(candidateData.sql);
  allResults = candidateData.results;

  // Step 3: Rank and score candidates
  steps.push({ name: 'Rank candidates against requirements', status: 'running' });
  const rankQuery = `Rank these candidates for the ${job.JobTitle || 'open'} position requiring ${skills}`;

  const analysis = await analyzeData(llm, cdata, rankQuery, history, lockedTables);
  totalTokens = addTokens(totalTokens, analysis.tokenUsage);
  steps[2].status = 'done';
  steps[2].duration = analysis.duration;

  // Step 4: Format final response
  steps.push({ name: 'Generate shortlist', status: 'done' });

  const response = `## Fill Requisition: ${job.JobTitle || 'Open Position'}\n\n` +
    `**Req:** ${job.ReqId || 'N/A'} | **Client:** ${job.ClientName || 'N/A'} | **Skills:** ${skills}\n\n` +
    `---\n\n` +
    `${analysis.response}\n\n` +
    `---\n\n` +
    `**Pipeline Summary:** ${candidateData.results.length} candidates evaluated, ` +
    `${Math.min(candidateData.results.length, 5)} shortlisted.\n\n` +
    `*Reply "move [name] to Submitted" to advance candidates.*`;

  return {
    type: 'fillReq',
    response,
    steps,
    sql: allSQL.join('\n\n'),
    results: allResults,
    duration: Date.now() - startTime,
    tokenUsage: totalTokens,
  };
}

// ── Chain: Candidate 360 ──

async function runCandidate360(
  llm: LLMClient, cdata: CDataClient, message: string, history: ChatMessage[], lockedTables?: string[],
): Promise<ChainResult> {
  const startTime = Date.now();
  const steps: ChainStep[] = [];
  let totalTokens = { ...ZERO_TOKENS };
  let allSQL: string[] = [];

  // Step 1: Get candidate profile
  steps.push({ name: 'Pull candidate profile', status: 'running' });
  const profileData = await gatherData(llm, cdata, message, history, lockedTables);
  totalTokens = addTokens(totalTokens, profileData.tokenUsage);
  steps[0].status = profileData.error ? 'failed' : 'done';
  steps[0].duration = profileData.duration;
  if (profileData.sql) allSQL.push(profileData.sql);

  if (profileData.results.length === 0) {
    return {
      type: 'candidate360',
      response: 'Could not find the candidate. Please provide a full name.',
      steps, sql: allSQL.join('\n\n'), results: [],
      duration: Date.now() - startTime, tokenUsage: totalTokens,
    };
  }

  const candidate = profileData.results[0];
  const candidateName = `${candidate.FirstName || ''} ${candidate.LastName || ''}`.trim();

  // Step 2: Get placement history
  steps.push({ name: 'Pull placement history', status: 'running' });
  const placementData = await gatherData(llm, cdata,
    `Show all placements for candidate ${candidateName}`, history, lockedTables);
  totalTokens = addTokens(totalTokens, placementData.tokenUsage);
  steps[1].status = 'done';
  steps[1].duration = placementData.duration;
  if (placementData.sql) allSQL.push(placementData.sql);

  // Step 3: Get activity history
  steps.push({ name: 'Pull activity history', status: 'running' });
  const activityData = await gatherData(llm, cdata,
    `Show recent activities for candidate ${candidateName}`, history, lockedTables);
  totalTokens = addTokens(totalTokens, activityData.tokenUsage);
  steps[2].status = 'done';
  steps[2].duration = activityData.duration;
  if (activityData.sql) allSQL.push(activityData.sql);

  // Step 4: Synthesize 360 view
  steps.push({ name: 'Generate 360 summary', status: 'running' });

  const synthesisPrompt = `Create a comprehensive 360 view for ${candidateName}:
Profile: ${JSON.stringify(candidate).substring(0, 1500)}
Placements (${placementData.results.length}): ${JSON.stringify(placementData.results.slice(0, 5)).substring(0, 1000)}
Activities (${activityData.results.length}): ${JSON.stringify(activityData.results.slice(0, 5)).substring(0, 1000)}

Format as a structured candidate brief with: Summary, Skills, Experience, Placement History, Recent Activity, Talking Points.`;

  const synthesis = await llm.rawCompletion(
    [
      { role: 'system', content: 'You are a recruiter assistant creating a comprehensive candidate brief. Use Markdown formatting.' },
      { role: 'user', content: synthesisPrompt },
    ],
    { temperature: 0.3, maxTokens: 1500 },
  );

  totalTokens = addTokens(totalTokens, {
    promptTokens: synthesis.promptTokens,
    completionTokens: synthesis.completionTokens,
    totalTokens: synthesis.promptTokens + synthesis.completionTokens,
    estimatedCost: synthesis.estimatedCost,
  });
  steps[3].status = 'done';

  return {
    type: 'candidate360',
    response: `## Candidate 360: ${candidateName}\n\n${synthesis.content}`,
    steps,
    sql: allSQL.join('\n\n'),
    results: profileData.results,
    duration: Date.now() - startTime,
    tokenUsage: totalTokens,
  };
}

// ── Chain: Daily Brief ──

async function runBrief(
  llm: LLMClient, cdata: CDataClient, message: string, history: ChatMessage[], lockedTables?: string[],
): Promise<ChainResult> {
  const startTime = Date.now();
  const steps: ChainStep[] = [];
  let totalTokens = { ...ZERO_TOKENS };
  let allSQL: string[] = [];

  // Step 1: Get today's interviews/activities
  steps.push({ name: 'Pull scheduled activities', status: 'running' });
  const activityData = await gatherData(llm, cdata,
    'Show all activities and interviews scheduled for today or this week', history, lockedTables);
  totalTokens = addTokens(totalTokens, activityData.tokenUsage);
  steps[0].status = 'done';
  steps[0].duration = activityData.duration;
  if (activityData.sql) allSQL.push(activityData.sql);

  // Step 2: Get open urgent reqs
  steps.push({ name: 'Pull urgent requisitions', status: 'running' });
  const reqData = await gatherData(llm, cdata,
    'Show open job requisitions with high priority or urgency', history, lockedTables);
  totalTokens = addTokens(totalTokens, reqData.tokenUsage);
  steps[1].status = 'done';
  steps[1].duration = reqData.duration;
  if (reqData.sql) allSQL.push(reqData.sql);

  // Step 3: Get recent placements/offers
  steps.push({ name: 'Pull recent offers and placements', status: 'running' });
  const placementData = await gatherData(llm, cdata,
    'Show recent placements and offers from the last 7 days', history, lockedTables);
  totalTokens = addTokens(totalTokens, placementData.tokenUsage);
  steps[2].status = 'done';
  steps[2].duration = placementData.duration;
  if (placementData.sql) allSQL.push(placementData.sql);

  // Step 4: Synthesize brief
  steps.push({ name: 'Generate brief', status: 'running' });

  const briefPrompt = `Create a recruiter's daily brief from this data:
Activities (${activityData.results.length}): ${JSON.stringify(activityData.results.slice(0, 10)).substring(0, 1200)}
Urgent Reqs (${reqData.results.length}): ${JSON.stringify(reqData.results.slice(0, 5)).substring(0, 800)}
Recent Placements (${placementData.results.length}): ${JSON.stringify(placementData.results.slice(0, 5)).substring(0, 800)}

Format with sections: Today's Priority Actions, Interviews & Follow-ups, Pipeline Status, Wins This Week.`;

  const brief = await llm.rawCompletion(
    [
      { role: 'system', content: 'You are a recruiter operations assistant. Create a concise, actionable daily brief in Markdown.' },
      { role: 'user', content: briefPrompt },
    ],
    { temperature: 0.3, maxTokens: 1200 },
  );

  totalTokens = addTokens(totalTokens, {
    promptTokens: brief.promptTokens,
    completionTokens: brief.completionTokens,
    totalTokens: brief.promptTokens + brief.completionTokens,
    estimatedCost: brief.estimatedCost,
  });
  steps[3].status = 'done';

  return {
    type: 'brief',
    response: `## Daily Brief\n\n${brief.content}`,
    steps,
    sql: allSQL.join('\n\n'),
    results: [...activityData.results, ...reqData.results],
    duration: Date.now() - startTime,
    tokenUsage: totalTokens,
  };
}

// ── Chain: Pipeline Cleanup ──

async function runCleanup(
  llm: LLMClient, cdata: CDataClient, message: string, history: ChatMessage[], lockedTables?: string[],
): Promise<ChainResult> {
  const startTime = Date.now();
  const steps: ChainStep[] = [];
  let totalTokens = { ...ZERO_TOKENS };
  let allSQL: string[] = [];

  // Step 1: Find stale candidates
  steps.push({ name: 'Identify stale candidates', status: 'running' });
  const staleData = await gatherData(llm, cdata,
    'Find candidates who have not been contacted in the last 30 days or have no last contact date', history, lockedTables);
  totalTokens = addTokens(totalTokens, staleData.tokenUsage);
  steps[0].status = 'done';
  steps[0].duration = staleData.duration;
  if (staleData.sql) allSQL.push(staleData.sql);

  // Step 2: Analyze and classify
  steps.push({ name: 'Classify candidates', status: 'running' });
  const analysis = await analyzeData(llm, cdata,
    `Classify these ${staleData.results.length} stale candidates into: active (recent activity), cold (30-90 days), inactive (90+ days). Recommend actions for each group.`,
    history, lockedTables);
  totalTokens = addTokens(totalTokens, analysis.tokenUsage);
  steps[1].status = 'done';
  steps[1].duration = analysis.duration;

  // Step 3: Generate cleanup plan
  steps.push({ name: 'Generate cleanup plan', status: 'done' });

  const response = `## Pipeline Cleanup Report\n\n` +
    `**Candidates Reviewed:** ${staleData.results.length}\n\n` +
    `---\n\n` +
    `${analysis.response}\n\n` +
    `---\n\n` +
    `*Reply "archive all inactive candidates" or "move stale candidates to Passive" to take action.*`;

  return {
    type: 'cleanup',
    response,
    steps,
    sql: allSQL.join('\n\n'),
    results: staleData.results,
    duration: Date.now() - startTime,
    tokenUsage: totalTokens,
  };
}

// ── Chain: End of Day Report ──

async function runEOD(
  llm: LLMClient, cdata: CDataClient, message: string, history: ChatMessage[], lockedTables?: string[],
): Promise<ChainResult> {
  const startTime = Date.now();
  const steps: ChainStep[] = [];
  let totalTokens = { ...ZERO_TOKENS };
  let allSQL: string[] = [];

  // Step 1: Get today's activities
  steps.push({ name: 'Pull today\'s activities', status: 'running' });
  const activityData = await gatherData(llm, cdata,
    'Show all activities logged today', history, lockedTables);
  totalTokens = addTokens(totalTokens, activityData.tokenUsage);
  steps[0].status = 'done';
  if (activityData.sql) allSQL.push(activityData.sql);

  // Step 2: Get status changes
  steps.push({ name: 'Pull status changes', status: 'running' });
  const statusData = await gatherData(llm, cdata,
    'Show candidates and jobs with status changes today', history, lockedTables);
  totalTokens = addTokens(totalTokens, statusData.tokenUsage);
  steps[1].status = 'done';
  if (statusData.sql) allSQL.push(statusData.sql);

  // Step 3: Generate EOD summary
  steps.push({ name: 'Generate EOD report', status: 'running' });

  const eodPrompt = `Create an end-of-day report:
Activities (${activityData.results.length}): ${JSON.stringify(activityData.results.slice(0, 10)).substring(0, 1200)}
Status Changes (${statusData.results.length}): ${JSON.stringify(statusData.results.slice(0, 10)).substring(0, 800)}

Format: Today's Summary (metrics), Key Actions Taken, Outstanding Items, Tomorrow's Priorities.`;

  const eod = await llm.rawCompletion(
    [
      { role: 'system', content: 'You are a recruiter operations assistant. Create a concise end-of-day report in Markdown.' },
      { role: 'user', content: eodPrompt },
    ],
    { temperature: 0.3, maxTokens: 1000 },
  );

  totalTokens = addTokens(totalTokens, {
    promptTokens: eod.promptTokens,
    completionTokens: eod.completionTokens,
    totalTokens: eod.promptTokens + eod.completionTokens,
    estimatedCost: eod.estimatedCost,
  });
  steps[2].status = 'done';

  return {
    type: 'eod',
    response: `## End of Day Report\n\n${eod.content}`,
    steps,
    sql: allSQL.join('\n\n'),
    results: [...activityData.results, ...statusData.results],
    duration: Date.now() - startTime,
    tokenUsage: totalTokens,
  };
}

// ── Chain Router ──

export async function executeChain(
  llm: LLMClient,
  cdata: CDataClient,
  message: string,
  conversationHistory: ChatMessage[],
  intent: IntentClassification,
  lockedTables?: string[],
): Promise<ChainResult> {
  const chainType = (intent.entities.chainType || 'brief') as ChainType;
  console.log(`[Chain] Executing chain: ${chainType}`);

  switch (chainType) {
    case 'fillReq':
      return runFillReq(llm, cdata, message, conversationHistory, lockedTables);
    case 'candidate360':
      return runCandidate360(llm, cdata, message, conversationHistory, lockedTables);
    case 'brief':
      return runBrief(llm, cdata, message, conversationHistory, lockedTables);
    case 'cleanup':
      return runCleanup(llm, cdata, message, conversationHistory, lockedTables);
    case 'eod':
      return runEOD(llm, cdata, message, conversationHistory, lockedTables);
    default:
      return runBrief(llm, cdata, message, conversationHistory, lockedTables);
  }
}
