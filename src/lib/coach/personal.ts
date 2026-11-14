import "server-only";

import { setBillAdjustments, type BillAdjustment } from "@/lib/analytics/recurrence";
import { accountProvider } from "@/lib/data/account-providers";
import {
  mergeAccounts,
  transactionKey,
  type DemoBank,
  type LinkedAccount,
  type LinkedKind,
} from "@/lib/data/linked-accounts";
import type { MortgageStory } from "@/lib/data/mortgage";
import { readState, readStates, writeState, type StateSnapshot } from "@/lib/data/repository";
import type { SetAside } from "@/lib/coach/goal-progress";

export type { SetAside };
import type { CustomerRecord, Transaction } from "@/lib/data/types";

/**
 * What a customer has added on top of the bank's own records: accounts linked
 * from elsewhere, their own corrections to how spending is sorted, their
 * adjustments to expected bills, and money they have set aside for goals.
 * All of it is sealed with the customer's key, and all of it is applied in one
 * place, here, so every calculation sees the same picture.
 */
const LINKED = "linked_accounts";
const CORRECTIONS = "corrections";
const SET_ASIDES = "set_asides";
const MAX_LINKED = 4;

export type Override = NonNullable<Transaction["override"]>;

export interface Corrections {
  /** One transaction, by its key. */
  transactions: Record<string, Override>;
  /** Every transaction of one kind: "category|mcc". */
  kinds: Record<string, Override>;
  /** Expected bills, by category. */
  bills: Record<string, BillAdjustment>;
}

const EMPTY: Corrections = { transactions: {}, kinds: {}, bills: {} };

export const kindKey = (tx: Pick<Transaction, "category" | "mcc">): string =>
  `${tx.category}|${tx.mcc ?? ""}`;

export async function listLinked(ref: string): Promise<LinkedAccount[]> {
  return (await readState<LinkedAccount[]>(ref, LINKED)) ?? [];
}

export async function readCorrections(ref: string): Promise<Corrections> {
  return { ...EMPTY, ...((await readState<Corrections>(ref, CORRECTIONS)) ?? {}) };
}

export async function listSetAsides(ref: string): Promise<SetAside[]> {
  return (await readState<SetAside[]>(ref, SET_ASIDES)) ?? [];
}

export const writeSetAsides = (ref: string, items: SetAside[]): Promise<void> =>
  writeState(ref, SET_ASIDES, items.slice(0, 200));

/** The kinds of state `personalise` needs, so a caller can fetch them with others in one read. */
export const PERSONAL_KINDS = [LINKED, CORRECTIONS, SET_ASIDES, "mortgage"] as const;

/**
 * Builds the customer's full picture from the bank's record: linked accounts
 * merged in, corrections applied, bill adjustments attached. Pass `states`
 * when they were already read, to save a round trip to the database.
 */
export async function personalise(
  ref: string,
  base: CustomerRecord,
  asOf: string,
  goalIds?: ReadonlySet<string>,
  states?: StateSnapshot,
): Promise<CustomerRecord> {
  const snapshot = states ?? (await readStates(ref, PERSONAL_KINDS));
  const linked = (snapshot.get(LINKED) as LinkedAccount[] | undefined) ?? [];
  const corrections: Corrections = {
    ...EMPTY,
    ...((snapshot.get(CORRECTIONS) as Corrections | undefined) ?? {}),
  };
  const setAsides = (snapshot.get(SET_ASIDES) as SetAside[] | undefined) ?? [];
  const mortgage = (snapshot.get("mortgage") as MortgageStory | undefined) ?? null;
  const provider = accountProvider();
  const merged = mergeAccounts(
    base.transactions,
    await Promise.all(
      linked.map(async (account) => ({
        account,
        transactions: await provider.transactions(account, ref, asOf),
      })),
    ),
    asOf,
  );
  const hasCorrections =
    Object.keys(corrections.transactions).length > 0 || Object.keys(corrections.kinds).length > 0;
  const transactions = hasCorrections
    ? merged.transactions.map((tx) => {
        const override =
          corrections.transactions[transactionKey(tx)] ?? corrections.kinds[kindKey(tx)];
        return override ? { ...tx, override } : tx;
      })
    : merged.transactions;
  if (Object.keys(corrections.bills).length > 0)
    setBillAdjustments(transactions, corrections.bills);
  const earmarkedCents = setAsides
    .filter((item) => item.goalId === null || !goalIds || goalIds.has(item.goalId))
    .reduce((sum, item) => sum + item.cents, 0);
  return {
    profile: base.profile,
    transactions,
    accounts: linked.length > 0 ? merged.accounts : undefined,
    earmarkedCents,
    mortgage: mortgage ?? undefined,
  };
}

// ---- Linked accounts ----

export type LinkError = "too_many" | "not_found";

export async function linkAccount(
  ref: string,
  input: { bank: DemoBank; kind: LinkedKind; nickname: string; included: boolean },
  asOf: string,
): Promise<LinkedAccount | LinkError> {
  const accounts = await listLinked(ref);
  if (accounts.length >= MAX_LINKED) return "too_many";
  const account: LinkedAccount = {
    id: `acct-${crypto.randomUUID()}`,
    bank: input.bank,
    kind: input.kind,
    nickname: input.nickname.trim().slice(0, 40),
    included: input.included,
    linkedOn: asOf,
  };
  await writeState(ref, LINKED, [...accounts, account]);
  return account;
}

export async function updateLinked(
  ref: string,
  id: string,
  change: { nickname?: string; included?: boolean },
): Promise<boolean> {
  const accounts = await listLinked(ref);
  if (!accounts.some((account) => account.id === id)) return false;
  await writeState(
    ref,
    LINKED,
    accounts.map((account) =>
      account.id === id
        ? {
            ...account,
            nickname: change.nickname?.trim().slice(0, 40) || account.nickname,
            included: change.included ?? account.included,
          }
        : account,
    ),
  );
  return true;
}

/** Removes the link and returns the account, so it can go to the recycle bin. */
export async function unlinkAccount(ref: string, id: string): Promise<LinkedAccount | null> {
  const accounts = await listLinked(ref);
  const account = accounts.find((candidate) => candidate.id === id) ?? null;
  if (account) {
    await writeState(
      ref,
      LINKED,
      accounts.filter((candidate) => candidate.id !== id),
    );
  }
  return account;
}

export async function restoreLinked(ref: string, account: LinkedAccount): Promise<void> {
  const accounts = await listLinked(ref);
  if (accounts.some((candidate) => candidate.id === account.id)) return;
  await writeState(ref, LINKED, [...accounts, account].slice(0, MAX_LINKED));
}

// ---- Corrections ----

export async function correctBasket(
  ref: string,
  target: { scope: "transaction"; key: string } | { scope: "kind"; key: string },
  override: Override,
): Promise<void> {
  const corrections = await readCorrections(ref);
  const bucket = target.scope === "transaction" ? "transactions" : "kinds";
  await writeState(ref, CORRECTIONS, {
    ...corrections,
    [bucket]: { ...corrections[bucket], [target.key]: override },
  });
}

export async function adjustBill(
  ref: string,
  category: string,
  adjustment: BillAdjustment,
): Promise<void> {
  const corrections = await readCorrections(ref);
  await writeState(ref, CORRECTIONS, {
    ...corrections,
    bills: { ...corrections.bills, [category]: adjustment },
  });
}

/** Undoes one correction, putting the rules' own answer back. */
export async function undoCorrection(
  ref: string,
  scope: "transaction" | "kind" | "bill",
  key: string,
): Promise<void> {
  const corrections = await readCorrections(ref);
  const bucket = scope === "transaction" ? "transactions" : scope === "kind" ? "kinds" : "bills";
  const { [key]: _removed, ...rest } = corrections[bucket] as Record<string, unknown>;
  void _removed;
  await writeState(ref, CORRECTIONS, { ...corrections, [bucket]: rest });
}

export async function undoAllCorrections(ref: string): Promise<void> {
  await writeState(ref, CORRECTIONS, EMPTY);
}
