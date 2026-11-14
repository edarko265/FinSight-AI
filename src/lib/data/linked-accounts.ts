import type { AccountSummary, Transaction } from "@/lib/data/types";

/**
 * Linked accounts at other banks: a SIMULATION.
 *
 * A real product would fetch these through the banks' account-information
 * interfaces (PSD2) after the customer approves access at each bank. That
 * connection does not exist here and is not pretended to: the banks are made
 * up and the transactions are generated. What is real is everything
 * downstream: once an account is linked, every calculation, chart and answer
 * runs over all the customer's accounts together.
 *
 * The generator is deterministic: the same customer and account always get
 * the same history, so figures do not change between visits and nothing has
 * to be stored except the fact that the account is linked.
 */
export const DEMO_BANKS = ["aurora", "kaski", "nordlys"] as const;
export type DemoBank = (typeof DEMO_BANKS)[number];
export const LINKED_KINDS = ["everyday", "savings", "credit"] as const;
export type LinkedKind = (typeof LINKED_KINDS)[number];

export interface LinkedAccount {
  id: string;
  bank: DemoBank;
  kind: LinkedKind;
  nickname: string;
  /** Whether its transactions take part in the calculations. */
  included: boolean;
  linkedOn: string;
}

const MONTHS_OF_HISTORY = 12;

/** A small seeded generator (mulberry32) so the fabricated history is repeatable. */
function seeded(seed: string): () => number {
  let h = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    h ^= seed.charCodeAt(index);
    h = Math.imul(h, 16777619);
  }
  let state = h >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const pad = (value: number): string => String(value).padStart(2, "0");

interface Draft {
  date: string;
  time: string;
  amountCents: number;
  category: string;
  type: string;
  merchantId: string | null;
  mcc: string | null;
}

/** Fabricated transactions for one linked account, up to and including `asOf`. */
export function generateLinked(account: LinkedAccount, seed: string, asOf: string): Transaction[] {
  const random = seeded(`${seed}|${account.id}|${account.kind}`);
  const between = (low: number, high: number): number => Math.round(low + random() * (high - low));
  const [year = 2026, month = 1] = asOf.split("-").map(Number);
  const drafts: Draft[] = [];
  const add = (
    y: number,
    m: number,
    day: number,
    amountCents: number,
    category: string,
    type: string,
    merchantId: string | null = null,
    mcc: string | null = null,
  ): void => {
    const date = `${y}-${pad(m)}-${pad(Math.min(day, 28))}`;
    if (date > asOf) return;
    drafts.push({
      date,
      time: `${pad(between(8, 20))}:${pad(between(0, 59))}:00`,
      amountCents,
      category,
      type,
      merchantId,
      mcc,
    });
  };
  const purchase = (
    y: number,
    m: number,
    category: string,
    mcc: string,
    low: number,
    high: number,
  ): void =>
    add(
      y,
      m,
      between(1, 28),
      -between(low, high),
      category,
      "purchase",
      `EXT-${mcc}-${between(1, 6)}`,
      mcc,
    );

  const tag = account.id.slice(-4).toUpperCase();
  for (let back = MONTHS_OF_HISTORY; back >= 0; back -= 1) {
    const index = year * 12 + (month - 1) - back;
    const y = Math.floor(index / 12);
    const m = (index % 12) + 1;
    if (account.kind === "everyday") {
      add(y, m, 2, between(35_000, 60_000), "Transfer", "transfer_in");
      // Two payments that recur at the same merchant for the same amount: subscriptions.
      add(y, m, 5, -1299, "Entertainment", "purchase", `EXT-STREAM-${tag}`, "7832");
      add(y, m, 10, -3990, "Lifestyle", "purchase", `EXT-GYM-${tag}`, "7999");
      for (let n = between(2, 4); n > 0; n -= 1) purchase(y, m, "Groceries", "5411", 1500, 6000);
      for (let n = between(1, 3); n > 0; n -= 1) purchase(y, m, "Restaurants", "5814", 800, 3500);
      for (let n = between(1, 3); n > 0; n -= 1)
        purchase(y, m, "Transportation", "4111", 300, 1500);
    } else if (account.kind === "savings") {
      add(y, m, 3, between(10_000, 30_000), "Transfer", "transfer_in");
      if (m % 3 === 0) add(y, m, 28, between(200, 900), "Other income", "other_income");
    } else {
      let spent = 0;
      const buy = (category: string, mcc: string, low: number, high: number): void => {
        const cents = between(low, high);
        spent += cents;
        add(y, m, between(1, 28), -cents, category, "purchase", `EXT-${mcc}-${between(1, 6)}`, mcc);
      };
      for (let n = between(2, 4); n > 0; n -= 1) buy("Lifestyle", "5651", 2000, 9000);
      for (let n = between(1, 2); n > 0; n -= 1) buy("Restaurants", "5812", 1500, 6000);
      if (random() < 0.35) buy("Home & Tech", "5732", 6000, 30_000);
      if (random() < 0.2) buy("Travel", "4511", 9000, 35_000);
      // The card is paid off from elsewhere each month.
      add(y, m, 27, spent, "Transfer", "transfer_in");
    }
  }
  drafts.sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));

  let balance =
    account.kind === "everyday"
      ? between(40_000, 150_000)
      : account.kind === "savings"
        ? between(200_000, 800_000)
        : -between(10_000, 40_000);
  return drafts.map((draft, index) => {
    balance += draft.amountCents;
    return { ...draft, row: index + 1, balanceCents: balance, account: account.id };
  });
}

/**
 * Merges the bank's own account with the included linked accounts in time
 * order. Each merged transaction carries the customer's combined balance
 * across all included accounts at that moment, so "the recorded balance"
 * keeps one meaning everywhere: everything the customer has, minus what they
 * owe on a card.
 */
export function mergeAccounts(
  main: readonly Transaction[],
  linked: { account: LinkedAccount; transactions: Transaction[] }[],
  asOf: string,
): { transactions: Transaction[]; accounts: AccountSummary[] } {
  const lastBalance = (list: readonly Transaction[]): number => {
    for (let index = list.length - 1; index >= 0; index -= 1) {
      const tx = list[index];
      if (tx && tx.date <= asOf) return tx.balanceCents;
    }
    return 0;
  };
  const accounts: AccountSummary[] = [
    { id: "main", kind: "main", balanceCents: lastBalance(main), included: true, simulated: false },
    ...linked.map(({ account, transactions }) => ({
      id: account.id,
      bank: account.bank,
      kind: account.kind,
      nickname: account.nickname,
      balanceCents: lastBalance(transactions),
      included: account.included,
      simulated: true,
    })),
  ];
  const included = linked.filter(({ account }) => account.included);
  if (included.length === 0) return { transactions: [...main], accounts };

  // What each account held just before its first transaction.
  const opening = (list: readonly Transaction[]): number => {
    const first = list[0];
    return first ? first.balanceCents - first.amountCents : 0;
  };
  const balances = new Map<string, number>([["main", opening(main)]]);
  for (const { account, transactions } of included) balances.set(account.id, opening(transactions));

  const reconciled = reconcileTransfers(main, included);
  const all = [...reconciled.main, ...reconciled.linked].sort(
    (a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time) || a.row - b.row,
  );
  const transactions = all.map((tx) => {
    balances.set(tx.account ?? "main", tx.balanceCents);
    let combined = 0;
    for (const value of balances.values()) combined += value;
    return { ...tx, balanceCents: combined };
  });
  return { transactions, accounts };
}

const MATCH_DAYS = 3;
const MATCH_TOLERANCE = 0.02;
const DAY_MS = 86_400_000;

/**
 * Works out which inflows to linked accounts are the customer's own money
 * moving, and which are income from outside.
 *
 * - Money into a savings account or onto a credit card is the customer's own:
 *   a deposit or a card payment, never income.
 * - Money into an everyday account is matched against transfers out of the
 *   customer's other accounts: the same amount (within 2 %) within three
 *   days is the same money, counted once. Each outflow is matched at most once.
 * - What is left unmatched arrived from outside, and counts as income.
 */
export function reconcileTransfers(
  main: readonly Transaction[],
  included: { account: LinkedAccount; transactions: Transaction[] }[],
): { main: Transaction[]; linked: Transaction[] } {
  const outflows = main
    .map((tx, index) => ({ tx, index, used: false }))
    .filter(({ tx }) => tx.type === "salary_sweep" || tx.type === "transfer_out");
  const internalMain = new Set<number>();
  const linked: Transaction[] = [];
  for (const { account, transactions } of included) {
    for (const tx of transactions) {
      if (tx.type !== "transfer_in") {
        linked.push(tx);
        continue;
      }
      if (account.kind !== "everyday") {
        linked.push({ ...tx, transfer: "internal" });
        continue;
      }
      const day = Date.parse(tx.date);
      const match = outflows.find(
        (candidate) =>
          !candidate.used &&
          Math.abs(Date.parse(candidate.tx.date) - day) <= MATCH_DAYS * DAY_MS &&
          Math.abs(-candidate.tx.amountCents - tx.amountCents) <= tx.amountCents * MATCH_TOLERANCE,
      );
      if (match) {
        match.used = true;
        internalMain.add(match.index);
        linked.push({ ...tx, transfer: "internal" });
      } else {
        linked.push({ ...tx, transfer: "external" });
      }
    }
  }
  return {
    main: main.map((tx, index) =>
      internalMain.has(index) ? { ...tx, transfer: "internal" as const } : tx,
    ),
    linked,
  };
}

/** The key that identifies one transaction across accounts, for corrections and evidence. */
export const transactionKey = (tx: Pick<Transaction, "row" | "account">): string =>
  `${tx.account ?? "main"}:${tx.row}`;
