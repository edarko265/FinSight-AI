import {
  classify,
  flowOf,
  isConsumption,
  type Basket,
  type Necessity,
} from "@/lib/analytics/classify";
import { inPeriod, monthKey, type Period } from "@/lib/analytics/periods";
import type { Transaction } from "@/lib/data/types";

export interface SpendingFilter {
  period: Period;
  categories?: readonly string[];
  mccs?: readonly string[];
}

export interface SpendingSummary {
  period: Period;
  /** Money spent, as a positive number of cents. */
  totalCents: number;
  transactionCount: number;
  byCategory: { category: string; totalCents: number; transactionCount: number }[];
}

function matches(tx: Transaction, filter: SpendingFilter): boolean {
  if (!isConsumption(tx) || !inPeriod(tx.date, filter.period)) return false;
  if (filter.categories?.length && !filter.categories.includes(tx.category)) return false;
  if (filter.mccs?.length && !(tx.mcc && filter.mccs.includes(tx.mcc))) return false;
  return true;
}

export function filterSpending(
  transactions: readonly Transaction[],
  filter: SpendingFilter,
): Transaction[] {
  return transactions.filter((tx) => matches(tx, filter));
}

/** Consumption in a period. Refunds (positive purchases) reduce the total. */
export function summariseSpending(
  transactions: readonly Transaction[],
  filter: SpendingFilter,
): SpendingSummary {
  const groups = new Map<string, { totalCents: number; transactionCount: number }>();
  let totalCents = 0;
  let transactionCount = 0;
  for (const tx of transactions) {
    if (!matches(tx, filter)) continue;
    totalCents -= tx.amountCents;
    transactionCount += 1;
    const group = groups.get(tx.category) ?? { totalCents: 0, transactionCount: 0 };
    group.totalCents -= tx.amountCents;
    group.transactionCount += 1;
    groups.set(tx.category, group);
  }
  const byCategory = [...groups.entries()]
    .map(([category, group]) => ({ category, ...group }))
    .sort((a, b) => b.totalCents - a.totalCents);
  return { period: filter.period, totalCents, transactionCount, byCategory };
}

/** Consumption per calendar month across a period, oldest first; empty months are zero. */
export function monthlySpending(
  transactions: readonly Transaction[],
  filter: SpendingFilter,
): { month: string; totalCents: number; transactionCount: number }[] {
  const months = new Map<string, { totalCents: number; transactionCount: number }>();
  for (let cursor = filter.period.startInclusive; cursor < filter.period.endExclusive;) {
    months.set(monthKey(cursor), { totalCents: 0, transactionCount: 0 });
    const [year = 0, month = 1] = cursor.split("-").map(Number);
    cursor =
      month === 12 ? `${year + 1}-01-01` : `${year}-${String(month + 1).padStart(2, "0")}-01`;
  }
  for (const tx of transactions) {
    if (!matches(tx, filter)) continue;
    const bucket = months.get(monthKey(tx.date));
    if (!bucket) continue;
    bucket.totalCents -= tx.amountCents;
    bucket.transactionCount += 1;
  }
  return [...months.entries()].map(([month, bucket]) => ({ month, ...bucket }));
}

export interface BasketBreakdown {
  period: Period;
  consumptionCents: number;
  baskets: {
    basket: Basket;
    totalCents: number;
    transactionCount: number;
    byNecessity: Record<Necessity, number>;
    categories: { category: string; totalCents: number }[];
  }[];
}

const BASKET_ORDER: Basket[] = ["regular", "irregular", "everyday", "unclassified"];

/** Every consumption transaction lands in exactly one basket; the baskets sum to consumption. */
export function basketBreakdown(
  transactions: readonly Transaction[],
  period: Period,
): BasketBreakdown {
  const state = new Map(
    BASKET_ORDER.map((basket) => [
      basket,
      {
        totalCents: 0,
        transactionCount: 0,
        byNecessity: { essential: 0, discretionary: 0, unknown: 0 } as Record<Necessity, number>,
        categories: new Map<string, number>(),
      },
    ]),
  );
  let consumptionCents = 0;
  for (const tx of transactions) {
    if (!isConsumption(tx) || !inPeriod(tx.date, period)) continue;
    const { basket, necessity } = classify(tx);
    const entry = state.get(basket);
    if (!entry) continue;
    const spent = -tx.amountCents;
    consumptionCents += spent;
    entry.totalCents += spent;
    entry.transactionCount += 1;
    entry.byNecessity[necessity] += spent;
    entry.categories.set(tx.category, (entry.categories.get(tx.category) ?? 0) + spent);
  }
  return {
    period,
    consumptionCents,
    baskets: BASKET_ORDER.map((basket) => {
      const entry = state.get(basket);
      return {
        basket,
        totalCents: entry?.totalCents ?? 0,
        transactionCount: entry?.transactionCount ?? 0,
        byNecessity: entry?.byNecessity ?? { essential: 0, discretionary: 0, unknown: 0 },
        categories: [...(entry?.categories ?? [])]
          .map(([category, totalCents]) => ({ category, totalCents }))
          .sort((a, b) => b.totalCents - a.totalCents),
      };
    }).filter((entry) => entry.basket !== "unclassified" || entry.transactionCount > 0),
  };
}

export interface CashFlow {
  period: Period;
  salaryCents: number;
  otherIncomeCents: number;
  consumptionCents: number;
  investedCents: number;
  investmentWithdrawnCents: number;
  salarySweepCents: number;
  unknownCents: number;
  netCents: number;
}

/** All account movements in a period, with consumption kept apart from transfers and investing. */
export function cashFlow(transactions: readonly Transaction[], period: Period): CashFlow {
  const flow: CashFlow = {
    period,
    salaryCents: 0,
    otherIncomeCents: 0,
    consumptionCents: 0,
    investedCents: 0,
    investmentWithdrawnCents: 0,
    salarySweepCents: 0,
    unknownCents: 0,
    netCents: 0,
  };
  for (const tx of transactions) {
    if (!inPeriod(tx.date, period)) continue;
    flow.netCents += tx.amountCents;
    switch (flowOf(tx)) {
      case "salary":
        flow.salaryCents += tx.amountCents;
        break;
      case "other_income":
        flow.otherIncomeCents += tx.amountCents;
        break;
      case "consumption":
        flow.consumptionCents -= tx.amountCents;
        break;
      case "investment_out":
        flow.investedCents -= tx.amountCents;
        break;
      case "investment_in":
        flow.investmentWithdrawnCents += tx.amountCents;
        break;
      case "salary_sweep":
        flow.salarySweepCents -= tx.amountCents;
        break;
      default:
        flow.unknownCents += tx.amountCents;
    }
  }
  return flow;
}

/** The balance recorded on the last transaction at or before the as-of date. */
export function recordedBalance(
  transactions: readonly Transaction[],
  asOf: string,
): { balanceCents: number; date: string } | null {
  for (let index = transactions.length - 1; index >= 0; index -= 1) {
    const tx = transactions[index];
    if (tx && tx.date <= asOf) return { balanceCents: tx.balanceCents, date: tx.date };
  }
  return null;
}

/** Recorded balance at the end of each month in a period. */
export function balanceByMonth(
  transactions: readonly Transaction[],
  period: Period,
): { month: string; balanceCents: number }[] {
  const last = new Map<string, number>();
  for (const tx of transactions) {
    if (inPeriod(tx.date, period)) last.set(monthKey(tx.date), tx.balanceCents);
  }
  return [...last.entries()].map(([month, balanceCents]) => ({ month, balanceCents }));
}
