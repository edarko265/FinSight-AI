import { classify, flowOf } from "@/lib/analytics/classify";
import {
  addDays,
  addMonths,
  completedMonths,
  inPeriod,
  monthKey,
  parts,
  toDate,
} from "@/lib/analytics/periods";
import { median } from "@/lib/analytics/stats";
import type { Transaction } from "@/lib/data/types";

/**
 * History-based suggestions, never certainties. The data has no payee names,
 * so recurrence is inferred per kind of payment, and every result should be
 * shown as a suggestion until the user confirms it.
 */
export interface IncomePattern {
  observations: number;
  typicalCents: number;
  /** Typical days of the month; 31 means "end of month". */
  typicalDays: number[];
  nextExpectedDate: string | null;
}

export interface RegularBill {
  category: string;
  monthsObserved: number;
  typicalMonthlyCents: number;
  /** Typical day of the month for a once-a-month bill; null when it is spread over the month. */
  typicalDay: number | null;
  nextExpectedDate: string | null;
}

const LOOKBACK_MONTHS = 6;

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function nextOccurrence(day: number, asOf: string): string {
  const { year, month } = parts(asOf);
  for (let offset = 0; offset < 3; offset += 1) {
    const first = addMonths(toDate(year, month, 1), offset);
    const p = parts(first);
    const candidate = toDate(p.year, p.month, Math.min(day, daysInMonth(p.year, p.month)));
    if (candidate > asOf) return candidate;
  }
  return addDays(asOf, 30);
}

export function detectIncome(transactions: readonly Transaction[], asOf: string): IncomePattern {
  const window = completedMonths(asOf, LOOKBACK_MONTHS);
  const start = window[0]?.startInclusive ?? asOf;
  const salaries = transactions.filter(
    (tx) => flowOf(tx) === "salary" && tx.date >= start && tx.date <= asOf,
  );
  const dayCounts = new Map<number, number>();
  for (const tx of salaries) {
    const { year, month, day } = parts(tx.date);
    const bucket =
      day >= daysInMonth(year, month) - 2 ? 31 : day <= 3 ? 1 : Math.round(day / 5) * 5;
    dayCounts.set(bucket, (dayCounts.get(bucket) ?? 0) + 1);
  }
  const typicalDays = [...dayCounts.entries()]
    .filter(([, count]) => count >= 3)
    .map(([day]) => day)
    .sort((a, b) => a - b);
  const nextDates = typicalDays.map((day) => nextOccurrence(day, asOf)).sort();
  return {
    observations: salaries.length,
    typicalCents: median(salaries.map((tx) => tx.amountCents)),
    typicalDays,
    nextExpectedDate: nextDates[0] ?? null,
  };
}

/** Regular commitments by category, from the completed months before the as-of date. */
export function detectRegularBills(
  transactions: readonly Transaction[],
  asOf: string,
): RegularBill[] {
  const months = completedMonths(asOf, LOOKBACK_MONTHS);
  const bills: RegularBill[] = [];
  const byCategory = new Map<string, Transaction[]>();
  for (const tx of transactions) {
    if (tx.date > asOf || classify(tx).basket !== "regular") continue;
    const list = byCategory.get(tx.category) ?? [];
    list.push(tx);
    byCategory.set(tx.category, list);
  }
  for (const [category, list] of byCategory) {
    const totals: number[] = [];
    const counts: number[] = [];
    const days: number[] = [];
    for (const month of months) {
      const inMonth = list.filter((tx) => inPeriod(tx.date, month));
      if (inMonth.length === 0) continue;
      totals.push(-inMonth.reduce((sum, tx) => sum + tx.amountCents, 0));
      counts.push(inMonth.length);
      for (const tx of inMonth) days.push(parts(tx.date).day);
    }
    if (totals.length < 3) continue;
    const oncePerMonth = median(counts) === 1;
    const typicalDay = oncePerMonth ? median(days) : null;
    let nextExpectedDate: string | null = null;
    if (typicalDay !== null) {
      const paidThisMonth = list.some(
        (tx) => monthKey(tx.date) === monthKey(asOf) && tx.date <= asOf,
      );
      // Already paid this month: the next one falls next month. Otherwise it may be due today.
      const from = paidThisMonth ? addDays(addMonths(asOf, 1), -1) : addDays(asOf, -1);
      nextExpectedDate = nextOccurrence(typicalDay, from);
    }
    bills.push({
      category,
      monthsObserved: totals.length,
      typicalMonthlyCents: median(totals),
      typicalDay,
      nextExpectedDate,
    });
  }
  return bills.sort((a, b) => b.typicalMonthlyCents - a.typicalMonthlyCents);
}
