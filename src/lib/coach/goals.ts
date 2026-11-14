import "server-only";

import { recordUsage } from "@/lib/admin/usage";
import { goalResult, planGoal, type Goal, type GoalPlan } from "@/lib/coach/advice";
import type { SessionContext } from "@/lib/coach/context";
import type { ToolResult } from "@/lib/coach/tools";
import { addToTrash, goalToTrash } from "@/lib/coach/trash";
import { readState, writeState } from "@/lib/data/repository";
import { translate } from "@/lib/i18n/translate";

const MAX_GOALS = 5;

export async function listGoals(ctx: SessionContext): Promise<Goal[]> {
  return (await readState<Goal[]>(ctx.customerRef, "goals")) ?? [];
}

export async function listGoalPlans(ctx: SessionContext): Promise<GoalPlan[]> {
  return (await listGoals(ctx)).map((goal) => planGoal(ctx, goal));
}

/** Saves a goal described in conversation and returns the plan for reaching it. */
export async function setGoal(
  ctx: SessionContext,
  input: { name?: string; targetCents: number; months?: number },
): Promise<ToolResult> {
  const targetCents = Math.min(100_000_000, Math.max(100, Math.round(input.targetCents)));
  const months = Math.min(120, Math.max(1, Math.round(input.months ?? 12)));
  const goal: Goal = {
    id: `goal-${crypto.randomUUID()}`,
    name: (input.name?.trim() || translate(ctx.locale, "goal.defaultName")).slice(0, 60),
    targetCents,
    months,
    monthlyCents: Math.ceil(targetCents / months),
    createdOn: ctx.asOf,
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
