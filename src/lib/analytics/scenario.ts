import { summariseSpending, type SpendingFilter } from "@/lib/analytics/spending";
import type { Transaction } from "@/lib/data/types";

export interface ReductionScenario {
  baselineCents: number;
  transactionCount: number;
  reductionBasisPoints: number;
  savingCents: number;
  resultingCents: number;
  /** Twelve times the monthly saving. An illustration, not a forecast. */
  annualisedSavingCents: number;
}

/** Rounds half away from zero, once per scenario. */
export function applyBasisPoints(cents: number, basisPoints: number): number {
  return Math.round((cents * basisPoints) / 10_000);
}

/**
 * What a percentage cut to a kind of spending would have been worth over a
 * completed baseline period. Always hypothetical.
 */
export function simulateReduction(
  transactions: readonly Transaction[],
  filter: SpendingFilter,
  reductionBasisPoints: number,
): ReductionScenario {
  if (
    !Number.isInteger(reductionBasisPoints) ||
    reductionBasisPoints < 0 ||
    reductionBasisPoints > 10_000
  ) {
    throw new RangeError("Reduction must be between 0% and 100%");
  }
  const baseline = summariseSpending(transactions, filter);
  const baselineCents = Math.max(0, baseline.totalCents);
  const savingCents = applyBasisPoints(baselineCents, reductionBasisPoints);
  return {
    baselineCents,
    transactionCount: baseline.transactionCount,
    reductionBasisPoints,
    savingCents,
    resultingCents: baselineCents - savingCents,
    annualisedSavingCents: savingCents * 12,
  };
}
