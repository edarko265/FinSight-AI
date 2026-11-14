import "server-only";

import { monthToDate } from "@/lib/analytics/periods";
import { summariseSpending } from "@/lib/analytics/spending";
import type { SessionContext } from "@/lib/coach/context";
import { TARGET_KEYS, TARGETS, type TargetKey } from "@/lib/coach/tools";
import { addToTrash } from "@/lib/coach/trash";
import { readState, writeState } from "@/lib/data/repository";

/**
 * Monthly limits the customer sets for a kind of spending. A limit is a
 * yardstick, not a block: nothing is ever stopped. The app shows how the
 * month is going against it and says so when it is nearly or fully used.
 */
export interface Budget {
  id: string;
  target: TargetKey;
  cents: number;
}

export interface BudgetStatus extends Budget {
  /** Spent on this so far this month. */
  spentCents: number;
  percent: number;
  level: "ok" | "close" | "over";
}

const KIND = "budgets";
const MAX = 12;
export const BUDGET_TARGETS = TARGET_KEYS;

async function listBudgets(ref: string): Promise<Budget[]> {
  return (await readState<Budget[]>(ref, KIND)) ?? [];
}

function budgetStatus(ctx: SessionContext, budget: Budget): BudgetStatus {
  const filter = TARGETS[budget.target];
  const spentCents = summariseSpending(ctx.record.transactions, {
    period: monthToDate(ctx.asOf),
    categories: filter.categories ? [...filter.categories] : undefined,
    mccs: filter.mccs ? [...filter.mccs] : undefined,
  }).totalCents;
  const percent = Math.round((spentCents / Math.max(1, budget.cents)) * 100);
  return {
    ...budget,
    spentCents,
    percent,
    level: percent >= 100 ? "over" : percent >= 80 ? "close" : "ok",
  };
}

export async function budgetStatuses(ctx: SessionContext): Promise<BudgetStatus[]> {
  return (await listBudgets(ctx.customerRef)).map((budget) => budgetStatus(ctx, budget));
}

/** Sets the limit for a kind of spending. One limit per kind: setting it again replaces it. */
export async function setBudget(
  ref: string,
  input: { target: TargetKey; cents: number },
): Promise<Budget | "too_many"> {
  const budgets = await listBudgets(ref);
  const existing = budgets.find((budget) => budget.target === input.target);
  if (!existing && budgets.length >= MAX) return "too_many";
  const next: Budget = {
    id: existing?.id ?? `budget-${crypto.randomUUID()}`,
    target: input.target,
    cents: Math.round(input.cents),
  };
  await writeState(
    ref,
    KIND,
    existing
      ? budgets.map((budget) => (budget.id === existing.id ? next : budget))
      : [...budgets, next],
  );
  return next;
}

export async function deleteBudget(ref: string, id: string): Promise<boolean> {
  const budgets = await listBudgets(ref);
  const removed = budgets.find((budget) => budget.id === id);
  if (!removed) return false;
  await writeState(
    ref,
    KIND,
    budgets.filter((budget) => budget.id !== id),
  );
  await addToTrash(ref, [
    {
      id: `trash-${crypto.randomUUID()}`,
      kind: "budget",
      deletedAt: new Date().toISOString(),
      label: removed.target,
      item: removed,
    },
  ]);
  return true;
}

export async function restoreBudget(ref: string, budget: Budget): Promise<void> {
  const budgets = await listBudgets(ref);
  if (!budgets.some((item) => item.target === budget.target)) {
    await writeState(ref, KIND, [...budgets, budget].slice(0, MAX));
  }
}
