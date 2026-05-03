// Compensation Normalization Utilities
// Converts between W2, C2C, and 1099 employment types for fair comparison

import { EmploymentType } from '@/types';

/**
 * Conversion factors to normalize different employment types to W2 equivalent
 *
 * Rationale:
 * - W2: Employer pays taxes, benefits, insurance (~30-35% overhead)
 * - C2C: Contractor's corp handles taxes/insurance, typically bill higher
 * - 1099: Self-employed, handles all taxes/insurance, highest bill rate
 *
 * To compare fairly, we normalize to W2 equivalent value
 */
export const COMPENSATION_FACTORS = {
  // W2 is baseline (1.0x)
  W2_MULTIPLIER: 1.0,

  // C2C typically bills 25-35% higher than W2 to cover corp expenses
  // So C2C rate * 0.75 ≈ W2 equivalent
  C2C_TO_W2: 0.75,

  // 1099 bills 30-40% higher than W2 to cover self-employment taxes
  // So 1099 rate * 0.70 ≈ W2 equivalent
  '1099_TO_W2': 0.70,

  // Standard hours for annual calculation
  HOURS_PER_YEAR: 2080, // 40 hrs/week * 52 weeks

  // Billable hours (accounting for PTO, holidays)
  BILLABLE_HOURS_PER_YEAR: 1880, // ~47 weeks
};

export interface NormalizedCompensation {
  originalRate: number;
  originalType: EmploymentType;
  isHourly: boolean;
  w2Equivalent: number;
  annualEquivalent: number;
  c2cEquivalent: number;
  '1099Equivalent': number;
  totalValue: number; // Estimated total cost to client
}

/**
 * Normalize a compensation rate to W2 equivalent for comparison
 */
export function normalizeToW2Equivalent(
  rate: number,
  employmentType: EmploymentType,
  isHourly: boolean = true
): NormalizedCompensation {
  // Convert annual to hourly if needed
  const hourlyRate = isHourly
    ? rate
    : rate / COMPENSATION_FACTORS.HOURS_PER_YEAR;

  // Calculate W2 equivalent based on employment type
  let w2Equivalent: number;

  switch (employmentType) {
    case 'W2':
      w2Equivalent = hourlyRate;
      break;
    case 'C2C':
      w2Equivalent = hourlyRate * COMPENSATION_FACTORS.C2C_TO_W2;
      break;
    case '1099':
      w2Equivalent = hourlyRate * COMPENSATION_FACTORS['1099_TO_W2'];
      break;
    default:
      w2Equivalent = hourlyRate;
  }

  // Calculate equivalents in other types
  const c2cEquivalent = w2Equivalent / COMPENSATION_FACTORS.C2C_TO_W2;
  const _1099Equivalent = w2Equivalent / COMPENSATION_FACTORS['1099_TO_W2'];

  // Annual equivalent (W2 basis)
  const annualEquivalent = w2Equivalent * COMPENSATION_FACTORS.HOURS_PER_YEAR;

  // Total value (what client pays including overhead for W2)
  // W2 employees cost ~30% more due to employer taxes, benefits, etc.
  const totalValue = w2Equivalent * 1.3 * COMPENSATION_FACTORS.BILLABLE_HOURS_PER_YEAR;

  return {
    originalRate: rate,
    originalType: employmentType,
    isHourly,
    w2Equivalent: Math.round(w2Equivalent * 100) / 100,
    annualEquivalent: Math.round(annualEquivalent),
    c2cEquivalent: Math.round(c2cEquivalent * 100) / 100,
    '1099Equivalent': Math.round(_1099Equivalent * 100) / 100,
    totalValue: Math.round(totalValue),
  };
}

/**
 * Compare two rates across different employment types
 */
export function compareRates(
  rate1: number,
  type1: EmploymentType,
  rate2: number,
  type2: EmploymentType,
  isHourly: boolean = true
): {
  rate1Normalized: number;
  rate2Normalized: number;
  difference: number;
  percentDifference: number;
  lowerCost: 1 | 2 | 'equal';
} {
  const norm1 = normalizeToW2Equivalent(rate1, type1, isHourly);
  const norm2 = normalizeToW2Equivalent(rate2, type2, isHourly);

  const difference = norm1.w2Equivalent - norm2.w2Equivalent;
  const percentDifference =
    norm2.w2Equivalent > 0
      ? ((norm1.w2Equivalent - norm2.w2Equivalent) / norm2.w2Equivalent) * 100
      : 0;

  let lowerCost: 1 | 2 | 'equal';
  if (Math.abs(difference) < 0.5) {
    lowerCost = 'equal';
  } else if (difference < 0) {
    lowerCost = 1;
  } else {
    lowerCost = 2;
  }

  return {
    rate1Normalized: norm1.w2Equivalent,
    rate2Normalized: norm2.w2Equivalent,
    difference: Math.round(difference * 100) / 100,
    percentDifference: Math.round(percentDifference * 10) / 10,
    lowerCost,
  };
}

/**
 * Calculate bill rate needed to achieve target margin
 */
export function calculateBillRate(
  payRate: number,
  targetMarginPercent: number,
  employmentType: EmploymentType
): number {
  // For W2, add employer burden (~30%)
  const employerBurden = employmentType === 'W2' ? 1.30 : 1.0;
  const adjustedPayRate = payRate * employerBurden;

  // Bill rate = Pay rate / (1 - margin)
  const billRate = adjustedPayRate / (1 - targetMarginPercent / 100);

  return Math.round(billRate * 100) / 100;
}

/**
 * Calculate margin from bill and pay rates
 */
export function calculateMargin(
  billRate: number,
  payRate: number,
  employmentType: EmploymentType
): {
  grossMargin: number;
  grossMarginPercent: number;
  netMargin: number;
  netMarginPercent: number;
} {
  // Gross margin (before employer costs)
  const grossMargin = billRate - payRate;
  const grossMarginPercent = (grossMargin / billRate) * 100;

  // Net margin (accounting for employer burden on W2)
  const employerBurden = employmentType === 'W2' ? payRate * 0.30 : 0;
  const netMargin = billRate - payRate - employerBurden;
  const netMarginPercent = (netMargin / billRate) * 100;

  return {
    grossMargin: Math.round(grossMargin * 100) / 100,
    grossMarginPercent: Math.round(grossMarginPercent * 10) / 10,
    netMargin: Math.round(netMargin * 100) / 100,
    netMarginPercent: Math.round(netMarginPercent * 10) / 10,
  };
}

/**
 * Format compensation for display
 */
export function formatCompensation(
  rate: number,
  employmentType: EmploymentType,
  isHourly: boolean = true
): string {
  const formatted = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(rate);

  if (isHourly) {
    return `${formatted}/hr (${employmentType})`;
  } else {
    return `${formatted}/yr (${employmentType})`;
  }
}
