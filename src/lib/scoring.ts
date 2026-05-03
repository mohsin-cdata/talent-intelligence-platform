// Candidate Matching & Scoring Algorithm
// Weights from PDF spec: Skills 40%, Location 20%, Availability 15%, Compensation 15%, Performance 10%

import { Candidate, JobRequisition, MatchScore, MatchBreakdown } from '@/types';
import { normalizeToW2Equivalent } from './compensation';
import { calculateDistance } from './geo-utils';

// Scoring weights
const WEIGHTS = {
  skills: 0.40,
  location: 0.20,
  availability: 0.15,
  compensation: 0.15,
  performance: 0.10,
};

/**
 * Calculate match score between a candidate and job requisition
 */
export function calculateMatchScore(
  candidate: Candidate,
  job: JobRequisition,
  skillSynonyms?: Map<string, string[]>
): MatchScore {
  const breakdown = getMatchBreakdown(candidate, job, skillSynonyms);

  const skillsScore = calculateSkillsScore(candidate, job, skillSynonyms);
  const locationScore = calculateLocationScore(candidate, job, breakdown);
  const availabilityScore = calculateAvailabilityScore(candidate, job);
  const compensationScore = calculateCompensationScore(candidate, job);
  const performanceScore = calculatePerformanceScore(candidate);

  const total = Math.round(
    skillsScore * WEIGHTS.skills +
    locationScore * WEIGHTS.location +
    availabilityScore * WEIGHTS.availability +
    compensationScore * WEIGHTS.compensation +
    performanceScore * WEIGHTS.performance
  );

  return {
    total,
    skillsScore: Math.round(skillsScore),
    locationScore: Math.round(locationScore),
    availabilityScore: Math.round(availabilityScore),
    compensationScore: Math.round(compensationScore),
    performanceScore: Math.round(performanceScore),
    breakdown,
  };
}

/**
 * Get detailed breakdown of the match
 */
function getMatchBreakdown(
  candidate: Candidate,
  job: JobRequisition,
  skillSynonyms?: Map<string, string[]>
): MatchBreakdown {
  const candidateSkills = normalizeSkills(candidate.skills, skillSynonyms);
  const requiredSkills = normalizeSkills(job.requiredSkills, skillSynonyms);

  const matchedSkills = requiredSkills.filter((skill) =>
    candidateSkills.some((cs) => cs.toLowerCase() === skill.toLowerCase())
  );
  const missingSkills = requiredSkills.filter(
    (skill) => !matchedSkills.map((s) => s.toLowerCase()).includes(skill.toLowerCase())
  );

  // Location matching
  let locationMatch: MatchBreakdown['locationMatch'] = 'No Match';
  let distanceMiles: number | null = null;

  if (candidate.remotePreference === 'Remote' && job.remoteOption === 'Yes') {
    locationMatch = 'Remote OK';
  } else if (
    candidate.city.toLowerCase() === job.city.toLowerCase() &&
    candidate.state.toLowerCase() === job.state.toLowerCase()
  ) {
    locationMatch = 'Exact';
    distanceMiles = 0;
  } else if (candidate.zipCode && job.zipCode) {
    distanceMiles = calculateDistance(candidate.zipCode, job.zipCode);
    if (distanceMiles !== null && distanceMiles <= 50) {
      locationMatch = 'Within Radius';
    }
  }

  // Compensation check
  const normalizedRate = normalizeToW2Equivalent(
    candidate.hourlyRate,
    candidate.employmentType,
    true
  ).w2Equivalent;
  const rateWithinBudget = normalizedRate >= job.minRate && normalizedRate <= job.maxRate;

  // Availability check
  const availabilityMatch =
    candidate.availabilityStatus === 'Active' ||
    candidate.availabilityStatus === 'Bench';

  return {
    matchedSkills,
    missingSkills,
    locationMatch,
    distanceMiles,
    rateWithinBudget,
    availabilityMatch,
  };
}

/**
 * Normalize skills using synonym mapping
 */
function normalizeSkills(
  skills: string[],
  synonymMap?: Map<string, string[]>
): string[] {
  if (!synonymMap) return skills;

  return skills.map((skill) => {
    const lower = skill.toLowerCase();
    for (const [canonical, synonyms] of synonymMap) {
      if (
        canonical.toLowerCase() === lower ||
        synonyms.some((s) => s.toLowerCase() === lower)
      ) {
        return canonical;
      }
    }
    return skill;
  });
}

/**
 * Calculate skills match score (0-100)
 */
function calculateSkillsScore(
  candidate: Candidate,
  job: JobRequisition,
  skillSynonyms?: Map<string, string[]>
): number {
  const candidateSkills = normalizeSkills(candidate.skills, skillSynonyms);
  const requiredSkills = normalizeSkills(job.requiredSkills, skillSynonyms);
  const niceToHaveSkills = normalizeSkills(job.niceToHaveSkills || [], skillSynonyms);

  if (requiredSkills.length === 0) return 100;

  // Required skills matching (80% of skills score)
  const requiredMatches = requiredSkills.filter((skill) =>
    candidateSkills.some((cs) => cs.toLowerCase() === skill.toLowerCase())
  ).length;
  const requiredScore = (requiredMatches / requiredSkills.length) * 80;

  // Nice-to-have skills matching (20% of skills score)
  let niceToHaveScore = 0;
  if (niceToHaveSkills.length > 0) {
    const niceMatches = niceToHaveSkills.filter((skill) =>
      candidateSkills.some((cs) => cs.toLowerCase() === skill.toLowerCase())
    ).length;
    niceToHaveScore = (niceMatches / niceToHaveSkills.length) * 20;
  } else {
    niceToHaveScore = 20; // Full score if no nice-to-have specified
  }

  return requiredScore + niceToHaveScore;
}

/**
 * Calculate location match score (0-100)
 */
function calculateLocationScore(
  candidate: Candidate,
  job: JobRequisition,
  breakdown: MatchBreakdown
): number {
  switch (breakdown.locationMatch) {
    case 'Exact':
      return 100;
    case 'Remote OK':
      return 95;
    case 'Within Radius':
      // Score decreases with distance
      if (breakdown.distanceMiles !== null) {
        return Math.max(60, 100 - breakdown.distanceMiles);
      }
      return 70;
    case 'No Match':
      // Check if willing to relocate
      if (candidate.willingToRelocate) {
        return 40;
      }
      return 0;
  }
}

/**
 * Calculate availability score (0-100)
 */
function calculateAvailabilityScore(
  candidate: Candidate,
  job: JobRequisition
): number {
  // Status-based scoring
  const statusScores: Record<string, number> = {
    Bench: 100,
    Active: 90,
    Passive: 50,
    Placed: 10,
  };

  let score = statusScores[candidate.availabilityStatus] || 50;

  // Adjust based on available date vs target start date
  if (candidate.availableDate && job.targetStartDate) {
    const availDate = new Date(candidate.availableDate);
    const targetDate = new Date(job.targetStartDate);
    const daysDiff = Math.ceil((availDate.getTime() - targetDate.getTime()) / (1000 * 60 * 60 * 24));

    if (daysDiff <= 0) {
      // Available before or on target date
      score = Math.min(100, score + 10);
    } else if (daysDiff <= 14) {
      // Within 2 weeks of target
      score = Math.max(0, score - 10);
    } else if (daysDiff <= 30) {
      // Within a month
      score = Math.max(0, score - 25);
    } else {
      // More than a month out
      score = Math.max(0, score - 40);
    }
  }

  return score;
}

/**
 * Calculate compensation fit score (0-100)
 */
function calculateCompensationScore(
  candidate: Candidate,
  job: JobRequisition
): number {
  const normalized = normalizeToW2Equivalent(
    candidate.hourlyRate,
    candidate.employmentType,
    true
  );
  const rate = normalized.w2Equivalent;
  const { minRate, maxRate } = job;

  if (rate >= minRate && rate <= maxRate) {
    // Within budget - score based on where in range
    const midPoint = (minRate + maxRate) / 2;
    const distanceFromMid = Math.abs(rate - midPoint);
    const maxDistance = (maxRate - minRate) / 2;
    return 100 - (distanceFromMid / maxDistance) * 20; // 80-100 range
  } else if (rate < minRate) {
    // Below budget (might be a red flag or great value)
    const percentBelow = ((minRate - rate) / minRate) * 100;
    return Math.max(60, 90 - percentBelow);
  } else {
    // Above budget
    const percentAbove = ((rate - maxRate) / maxRate) * 100;
    if (percentAbove <= 10) return 60;
    if (percentAbove <= 20) return 40;
    if (percentAbove <= 30) return 20;
    return 0;
  }
}

/**
 * Calculate performance score based on history (0-100)
 */
function calculatePerformanceScore(candidate: Candidate): number {
  let score = 50; // Base score

  // Placement history
  if (candidate.placementCount > 0) {
    score += Math.min(20, candidate.placementCount * 4);
  }

  // Average rating (1-5 scale)
  if (candidate.avgRating) {
    score += (candidate.avgRating / 5) * 30;
  }

  return Math.min(100, score);
}

/**
 * Rank candidates for a job
 */
export function rankCandidatesForJob(
  candidates: Candidate[],
  job: JobRequisition,
  skillSynonyms?: Map<string, string[]>,
  limit: number = 20
): Array<{ candidate: Candidate; score: MatchScore }> {
  const scored = candidates.map((candidate) => ({
    candidate,
    score: calculateMatchScore(candidate, job, skillSynonyms),
  }));

  return scored
    .sort((a, b) => b.score.total - a.score.total)
    .slice(0, limit);
}

/**
 * Find best matching jobs for a candidate
 */
export function rankJobsForCandidate(
  candidate: Candidate,
  jobs: JobRequisition[],
  skillSynonyms?: Map<string, string[]>,
  limit: number = 10
): Array<{ job: JobRequisition; score: MatchScore }> {
  const scored = jobs
    .filter((job) => job.status === 'Open')
    .map((job) => ({
      job,
      score: calculateMatchScore(candidate, job, skillSynonyms),
    }));

  return scored
    .sort((a, b) => b.score.total - a.score.total)
    .slice(0, limit);
}
