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
  /** True when the customer changed the amount or the day. */
  adjusted: boolean;
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

/** What the customer has told us about a regular bill: its real amount, its day, or that it is not regular. */
export interface BillAdjustment {
  cents?: number;
  day?: number;
  skip?: boolean;
}

/**
 * Adjustments travel with the transaction list they belong to, so every
 * calculation that looks for regular bills sees them without each caller
 * having to pass them along.
 */
const ADJUSTMENTS = new WeakMap<readonly Transaction[], Record<string, BillAdjustment>>();

export function setBillAdjustments(
  transactions: readonly Transaction[],
  adjustments: Record<string, BillAdjustment>,
): void {
  ADJUSTMENTS.set(transactions, adjustments);
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
      adjusted: false,
    });
  }
  const adjustments = ADJUSTMENTS.get(transactions) ?? {};
  return bills
    .filter((bill) => !adjustments[bill.category]?.skip)
    .map((bill) => {
      const change = adjustments[bill.category];
      if (!change || (change.cents === undefined && change.day === undefined)) return bill;
      const day = change.day ?? bill.typicalDay;
      return {
        ...bill,
        typicalMonthlyCents: change.cents ?? bill.typicalMonthlyCents,
        typicalDay: day,
        nextExpectedDate:
          change.day !== undefined && day !== null
            ? nextOccurrence(day, addDays(asOf, -1))
            : bill.nextExpectedDate,
        adjusted: true,
      };
    })
    .sort((a, b) => b.typicalMonthlyCents - a.typicalMonthlyCents);
}

/** Regular bills exactly as the history suggests them, before the customer's adjustments. */
export function detectRegularBillsUnadjusted(
  transactions: readonly Transaction[],
  asOf: string,
): RegularBill[] {
  return detectRegularBills([...transactions], asOf);
}

export interface Subscription {
  merchantId: string;
  category: string;
  mcc: string | null;
  /** Linked account it is paid from, if not the bank's own. */
  account?: string;
  monthsObserved: number;
  typicalCents: number;
  typicalDay: number;
  nextExpectedDate: string;
}

const SUBSCRIPTION_MONTHS = 6;
/** Payments to one merchant count as a subscription when their amounts differ by no more than this. */
const SUBSCRIPTION_TOLERANCE = 0.1;

/**
 * Subscription-like payments: the same merchant, about once a month, for about
 * the same amount, in at least three of the last six full months. The data has
 * no payee names, so a subscription is known only by its merchant number and
 * the kind of merchant; it is a suggestion, not a fact.
 */
export function detectSubscriptions(
  transactions: readonly Transaction[],
  asOf: string,
): Subscription[] {
  const months = completedMonths(asOf, SUBSCRIPTION_MONTHS);
  const start = months[0]?.startInclusive ?? asOf;
  const byMerchant = new Map<string, Transaction[]>();
  for (const tx of transactions) {
    if (!tx.merchantId || flowOf(tx) !== "consumption" || tx.date < start || tx.date > asOf)
      continue;
    const key = `${tx.account ?? "main"}|${tx.merchantId}`;
    const list = byMerchant.get(key) ?? [];
    list.push(tx);
    byMerchant.set(key, list);
  }
  const found: Subscription[] = [];
  for (const list of byMerchant.values()) {
    const amounts: number[] = [];
    const days: number[] = [];
    let regular = true;
    for (const month of months) {
      const inMonth = list.filter((tx) => inPeriod(tx.date, month));
      if (inMonth.length === 0) continue;
      // More than one payment in a month is shopping, not a subscription.
      if (inMonth.length > 1) {
        regular = false;
        break;
      }
      const tx = inMonth[0];
      if (!tx) continue;
      amounts.push(-tx.amountCents);
      days.push(parts(tx.date).day);
    }
    if (!regular || amounts.length < 3) continue;
    const typical = median(amounts);
    if (typical <= 0) continue;
    const spread = (Math.max(...amounts) - Math.min(...amounts)) / typical;
    if (spread > SUBSCRIPTION_TOLERANCE) continue;
    const first = list[0];
    if (!first?.merchantId) continue;
    const day = median(days);
    found.push({
      merchantId: first.merchantId,
      category: first.category,
      mcc: first.mcc,
      account: first.account,
      monthsObserved: amounts.length,
      typicalCents: typical,
      typicalDay: day,
      nextExpectedDate: nextOccurrence(day, asOf),
    });
  }
  return found.sort((a, b) => b.typicalCents - a.typicalCents);
}
