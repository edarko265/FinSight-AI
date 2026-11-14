import type { Transaction } from "@/lib/data/types";

/**
 * Income and expenses the customer records themselves: cash spent, money
 * received that has not reached the account record yet, anything the bank's
 * own history does not show. Each one becomes a transaction on the bank's own
 * account, so the balance, the baskets, the monthly limits and the plan all
 * move with it.
 */
export const ENTRY_KINDS = ["income", "expense"] as const;
export type EntryKind = (typeof ENTRY_KINDS)[number];

/** Where recorded income came from. Salary counts as salary; the rest as other income. */
export const INCOME_SOURCES = ["salary", "benefit", "gift", "sale", "refund", "other"] as const;
export type IncomeSource = (typeof INCOME_SOURCES)[number];

export interface Entry {
  id: string;
  /** Stands in for the source row, so the entry has a stable key like any transaction. */
  row: number;
  kind: EntryKind;
  /** Always positive; the kind gives the direction. */
  cents: number;
  /** Local calendar date, YYYY-MM-DD. */
  date: string;
  /** A spending category for an expense, an income source for income. */
  category: string;
  note: string;
}

/** Rows of recorded entries start here, far above any row in the bank's file. */
export const ENTRY_ROW_BASE = 1_000_000_000;
const ENTRY_TIME = "12:00:00";

function toTransaction(entry: Entry): Transaction {
  const income = entry.kind === "income";
  return {
    row: entry.row,
    date: entry.date,
    time: ENTRY_TIME,
    amountCents: income ? entry.cents : -entry.cents,
    balanceCents: 0,
    category: income ? (entry.category === "salary" ? "Salary" : "Other income") : entry.category,
    type: income ? (entry.category === "salary" ? "salary" : "other_income") : "purchase",
    merchantId: null,
    mcc: null,
    manual: true,
    ...(entry.note ? { note: entry.note } : {}),
  };
}

/**
 * Puts the customer's own entries into the account's history in time order
 * and carries each one through every balance recorded after it. Entries dated
 * after `asOf` are left out.
 */
export function applyEntries(
  main: readonly Transaction[],
  entries: readonly Entry[],
  asOf: string,
): Transaction[] {
  const added = entries.filter((entry) => entry.date <= asOf).map(toTransaction);
  if (added.length === 0) return [...main];
  const first = main[0];
  const opening = first ? first.balanceCents - first.amountCents : 0;
  const all = [...main, ...added].sort(
    (a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time) || a.row - b.row,
  );
  let offset = 0;
  let last = opening;
  return all.map((tx) => {
    if (tx.manual) {
      offset += tx.amountCents;
      last += tx.amountCents;
      return { ...tx, balanceCents: last };
    }
    last = tx.balanceCents + offset;
    return offset === 0 ? tx : { ...tx, balanceCents: last };
  });
}
