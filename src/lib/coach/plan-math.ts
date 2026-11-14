import { basketBreakdown, cashFlow } from "@/lib/analytics/spending";
import { completedMonths } from "@/lib/analytics/periods";
import type { Transaction } from "@/lib/data/types";

/**
 * A plan is a way of splitting a month's income into five slices, in whole
 * percentages that add up to 100. Percentages are the only thing a plan
 * carries: it never holds an amount, so sharing one cannot reveal what
 * anybody earns, spends or saves.
 */
export const SLICES = ["bills", "essentials", "everyday", "saving", "investing"] as const;
export type SliceKey = (typeof SLICES)[number];
export type Split = Record<SliceKey, number>;

/** Starting points offered when making a plan. */
export const TEMPLATES: Record<"balanced" | "saver" | "careful", Split> = {
  balanced: { bills: 35, essentials: 10, everyday: 30, saving: 20, investing: 5 },
  saver: { bills: 35, essentials: 10, everyday: 20, saving: 25, investing: 10 },
  careful: { bills: 45, essentials: 12, everyday: 33, saving: 8, investing: 2 },
};
export type TemplateKey = keyof typeof TEMPLATES;

/**
 * Turns amounts into whole percentages that add up to exactly 100
 * (largest-remainder method): each share is rounded down, then the points
 * left over go to the shares that lost the most by rounding.
 */
export function toPercents(amounts: readonly number[]): number[] {
  const safe = amounts.map((amount) => Math.max(0, amount));
  const total = safe.reduce((sum, amount) => sum + amount, 0);
  if (total === 0) return safe.map(() => 0);
  const exact = safe.map((amount) => (amount / total) * 100);
  const floors = exact.map(Math.floor);
  let left = 100 - floors.reduce((sum, value) => sum + value, 0);
  const order = exact
    .map((value, index) => ({ index, remainder: value - Math.floor(value) }))
    .sort((a, b) => b.remainder - a.remainder || a.index - b.index);
  for (const { index } of order) {
    if (left === 0) break;
    floors[index] = (floors[index] ?? 0) + 1;
    left -= 1;
  }
  return floors;
}

export const isValidSplit = (split: Split): boolean =>
  SLICES.every((key) => Number.isInteger(split[key]) && split[key] >= 0 && split[key] <= 100) &&
  SLICES.reduce((sum, key) => sum + split[key], 0) === 100;

export interface ActualSplit {
  /** Average monthly income over the months used. Never leaves the customer's own session. */
  incomeCents: number;
  cents: Split;
  percent: Split;
  months: number;
}

/**
 * How the customer's money has actually been split: the average of the last
 * three completed months. Saving is what was left of income after the three
 * baskets and investing; if more went out than came in, saving is zero and
 * the shares are of what went out.
 */
export function actualSplit(transactions: readonly Transaction[], asOf: string): ActualSplit {
  const months = completedMonths(asOf, 3);
  const mean = (values: number[]): number =>
    values.length === 0 ? 0 : Math.round(values.reduce((sum, v) => sum + v, 0) / values.length);
  const perMonth = months.map((month) => {
    const flow = cashFlow(transactions, month);
    const baskets = basketBreakdown(transactions, month).baskets;
    const basket = (name: string): number =>
      baskets.find((entry) => entry.basket === name)?.totalCents ?? 0;
    return {
      income: flow.salaryCents + flow.otherIncomeCents,
      bills: basket("regular"),
      essentials: basket("irregular"),
      everyday: basket("everyday") + basket("unclassified"),
      investing: flow.investedCents,
    };
  });
  const incomeCents = mean(perMonth.map((month) => month.income));
  const bills = mean(perMonth.map((month) => month.bills));
  const essentials = mean(perMonth.map((month) => month.essentials));
  const everyday = mean(perMonth.map((month) => month.everyday));
  const investing = mean(perMonth.map((month) => month.investing));
  const saving = Math.max(0, incomeCents - bills - essentials - everyday - investing);
  const cents: Split = { bills, essentials, everyday, saving, investing };
  const percents = toPercents(SLICES.map((key) => cents[key]));
  const percent = Object.fromEntries(
    SLICES.map((key, index) => [key, percents[index] ?? 0]),
  ) as Split;
  return { incomeCents, cents, percent, months: months.length };
}

/** What a plan's percentages come to for one person's own income. Shown only to that person. */
export function applySplit(split: Split, incomeCents: number): Split {
  return Object.fromEntries(
    SLICES.map((key) => [key, Math.round((incomeCents * split[key]) / 100)]),
  ) as Split;
}

/** A plan name may not smuggle an amount out: no currency signs and no run of three or more digits. */
export const nameCarriesAmount = (name: string): boolean => /[€$£]|\d{3,}|\beur\b/i.test(name);
