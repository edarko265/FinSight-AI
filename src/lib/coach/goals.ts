import "server-only";

import { recordUsage } from "@/lib/admin/usage";
import { goalResult, planGoal, safeToSave, type Goal } from "@/lib/coach/advice";
import { goalProgress, type GoalProgress } from "@/lib/coach/goal-progress";
import { listSetAsides, writeSetAsides, type SetAside } from "@/lib/coach/personal";
import type { SessionContext } from "@/lib/coach/context";
import type { ToolResult } from "@/lib/coach/tools";
import { addToTrash, goalToTrash } from "@/lib/coach/trash";
import { readState, writeState } from "@/lib/data/repository";
import { translate } from "@/lib/i18n/translate";

const MAX_GOALS = 5;

/** The same day of the month, `months` earlier (the 28th at the latest, so every month has it). */
function monthsBefore(date: string, months: number): string {
  if (months === 0) return date;
  const [year = 2026, month = 1, day = 1] = date.split("-").map(Number);
  const index = year * 12 + (month - 1) - months;
  return `${Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, "0")}-${String(Math.min(day, 28)).padStart(2, "0")}`;
}

export async function listGoals(ctx: SessionContext): Promise<Goal[]> {
  return (await readState<Goal[]>(ctx.customerRef, "goals")) ?? [];
}

export async function listGoalPlans(ctx: SessionContext): Promise<GoalProgress[]> {
  const setAsides = await listSetAsides(ctx.customerRef);
  return (await listGoals(ctx)).map((goal) =>
    goalProgress(planGoal(ctx, goal), setAsides, ctx.asOf),
  );
}

export type SetAsideError = "above_safe" | "not_found" | "bad_date";

/**
 * Marks money as set aside for a goal. Nothing is moved: the customer makes
 * the transfer themselves, or simply treats the money as spoken for. The
 * amount may not exceed what is safe to save, so the next month of bills,
 * essentials and usual spending stays covered; from then on it is left out of
 * what is safe to spend.
 */
export async function setAside(
  ctx: SessionContext,
  input: { goalId: string | null; cents: number; date?: string },
): Promise<SetAside | SetAsideError> {
  const goal = input.goalId
    ? (await listGoals(ctx)).find((candidate) => candidate.id === input.goalId)
    : undefined;
  if (input.goalId && !goal) return "not_found";
  // Money set aside earlier can be recorded with its date, from the goal's start up to today.
  const date = input.date ?? ctx.asOf;
  if (date > ctx.asOf || (goal && date < goal.createdOn)) return "bad_date";
  // Setting aside today is tested against what is safe now. Money recorded as set aside
  // earlier is a fact about the past, so it is not.
  if (date === ctx.asOf && input.cents > safeToSave(ctx).safeCents) return "above_safe";
  const item: SetAside = {
    id: `aside-${crypto.randomUUID()}`,
    goalId: input.goalId,
    cents: Math.round(input.cents),
    date,
  };
  await writeSetAsides(ctx.customerRef, [item, ...(await listSetAsides(ctx.customerRef))]);
  await recordUsage("goal", "set_aside", ctx.locale);
  return item;
}

/** Takes a set-aside back (the money counts as spendable again) and puts it in the recycle bin. */
export async function removeSetAside(ctx: SessionContext, id: string): Promise<boolean> {
  const all = await listSetAsides(ctx.customerRef);
  const item = all.find((candidate) => candidate.id === id);
  if (!item) return false;
  await writeSetAsides(
    ctx.customerRef,
    all.filter((candidate) => candidate.id !== id),
  );
  await addToTrash(ctx.customerRef, [
    {
      id: `trash-${crypto.randomUUID()}`,
      kind: "setaside",
      deletedAt: new Date().toISOString(),
      label: String(item.cents),
      item,
    },
  ]);
  return true;
}

export async function restoreSetAside(ctx: SessionContext, item: SetAside): Promise<void> {
  const all = await listSetAsides(ctx.customerRef);
  if (!all.some((candidate) => candidate.id === item.id)) {
    await writeSetAsides(ctx.customerRef, [item, ...all]);
  }
}

/** Saves a goal described in conversation and returns the plan for reaching it. */
export async function setGoal(
  ctx: SessionContext,
  input: { name?: string; targetCents: number; months?: number; startedMonthsAgo?: number },
): Promise<ToolResult> {
  const targetCents = Math.min(100_000_000, Math.max(100, Math.round(input.targetCents)));
  const months = Math.min(120, Math.max(1, Math.round(input.months ?? 12)));
  const goal: Goal = {
    id: `goal-${crypto.randomUUID()}`,
    name: (input.name?.trim() || translate(ctx.locale, "goal.defaultName")).slice(0, 60),
    targetCents,
    months,
    monthlyCents: Math.ceil(targetCents / months),
    // A goal the customer was already saving towards can start in the past.
    createdOn: monthsBefore(ctx.asOf, Math.min(36, Math.max(0, input.startedMonthsAgo ?? 0))),
  };
  const goals = [goal, ...(await listGoals(ctx))].slice(0, MAX_GOALS);
  await writeState(ctx.customerRef, "goals", goals);
  await recordUsage("goal", "set", ctx.locale);
  return { ...goalResult(ctx, planGoal(ctx, goal), true), query: undefined };
}

/** Edits a goal's name, amount or time span and recalculates the monthly amount. */
export async function updateGoal(
  ctx: SessionContext,
  id: string,
  patch: { name?: string; targetCents?: number; months?: number },
): Promise<boolean> {
  const goals = await listGoals(ctx);
  const current = goals.find((goal) => goal.id === id);
  if (!current) return false;
  const targetCents = Math.min(
    100_000_000,
    Math.max(100, Math.round(patch.targetCents ?? current.targetCents)),
  );
  const months = Math.min(120, Math.max(1, Math.round(patch.months ?? current.months)));
  const next: Goal = {
    ...current,
    name: (patch.name?.trim() || current.name).slice(0, 60),
    targetCents,
    months,
    monthlyCents: Math.ceil(targetCents / months),
  };
  await writeState(
    ctx.customerRef,
    "goals",
    goals.map((goal) => (goal.id === id ? next : goal)),
  );
  return true;
}

/** Moves a goal to the recycle bin. */
export async function deleteGoal(ctx: SessionContext, id: string): Promise<void> {
  const goals = await listGoals(ctx);
  const removed = goals.find((goal) => goal.id === id);
  if (!removed) return;
  await writeState(
    ctx.customerRef,
    "goals",
    goals.filter((goal) => goal.id !== id),
  );
  await addToTrash(ctx.customerRef, [goalToTrash(removed)]);
}

export async function restoreGoal(ctx: SessionContext, goal: Goal): Promise<void> {
  await writeState(ctx.customerRef, "goals", [goal, ...(await listGoals(ctx))].slice(0, MAX_GOALS));
}

/** The current goals as a coach answer. */
export async function goalsResult(ctx: SessionContext): Promise<ToolResult> {
  const plans = await listGoalPlans(ctx);
  const first = plans[0];
  if (!first) {
    return {
      tool: "goal",
      text: translate(ctx.locale, "goal.none"),
      facts: [],
      followUps: [translate(ctx.locale, "chat.suggest.goal")],
    };
  }
  return goalResult(ctx, first, false);
}
