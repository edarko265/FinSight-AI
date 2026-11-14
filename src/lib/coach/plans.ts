import "server-only";

import { randomBytes } from "node:crypto";

import { recordUsage } from "@/lib/admin/usage";
import type { SessionContext } from "@/lib/coach/context";
import { listGoals } from "@/lib/coach/goals";
import { isValidSplit, nameCarriesAmount, toPercents, type Split } from "@/lib/coach/plan-math";
import { addToTrash } from "@/lib/coach/trash";
import { readState, writeState } from "@/lib/data/repository";
import { getDb } from "@/lib/db/client";
import { decryptField, encryptField } from "@/lib/security/crypto";
import { serviceKey } from "@/lib/security/keys";

/**
 * Plans: named splits of a month's income, which a customer can keep, share
 * and copy.
 *
 * A customer's own plans are sealed with their key, like their goals. Sharing
 * publishes a separate record that holds only the name and the percentages,
 * under a random code, with no reference to the customer. Friends who are
 * given the code, or anyone if the plan is listed, can copy it; they see what
 * the percentages come to for their own income, never anything of the
 * sharer's.
 */
export interface Plan {
  id: string;
  name: string;
  split: Split;
  /** How the saving slice is divided between goals, in percentages of that slice. */
  goals: { label: string; percent: number }[];
  origin: "own" | "template" | "copied";
  createdOn: string;
  /** The one plan the customer follows: the app says when their month drifts from it. */
  tracked?: boolean;
  /** Set while the plan is shared. */
  shareCode?: string;
  shareListed?: boolean;
}

/** Exactly what leaves the customer when a plan is shared. No amounts exist in this shape. */
export interface PublicPlan {
  code: string;
  name: string;
  split: Split;
  goals: { label: string; percent: number }[];
  listed: boolean;
  copies: number;
}

const KIND = "plans";
const MAX_PLANS = 8;
const key = () => serviceKey("shared-plans");
const aad = (code: string): string => `shared_plans.plan:${code}`;

export async function listPlans(ctx: SessionContext): Promise<Plan[]> {
  return (await readState<Plan[]>(ctx.customerRef, KIND)) ?? [];
}

const save = (ctx: SessionContext, plans: Plan[]): Promise<void> =>
  writeState(ctx.customerRef, KIND, plans.slice(0, MAX_PLANS));

export type PlanError = "invalid_split" | "name_has_amount" | "too_many" | "not_found";

/** How the customer's saving is divided between their goals, as percentages of the saving slice. */
export async function goalShares(ctx: SessionContext): Promise<Plan["goals"]> {
  const goals = await listGoals(ctx);
  const percents = toPercents(goals.map((goal) => goal.monthlyCents));
  return goals.map((goal, index) => ({ label: goal.name, percent: percents[index] ?? 0 }));
}

export async function createPlan(
  ctx: SessionContext,
  input: { name: string; split: Split; origin: Plan["origin"]; goals?: Plan["goals"] },
): Promise<Plan | PlanError> {
  if (!isValidSplit(input.split)) return "invalid_split";
  if (nameCarriesAmount(input.name)) return "name_has_amount";
  const plans = await listPlans(ctx);
  if (plans.length >= MAX_PLANS) return "too_many";
  const plan: Plan = {
    id: `plan-${crypto.randomUUID()}`,
    name: input.name.trim().slice(0, 60),
    split: input.split,
    goals: input.goals ?? (input.origin === "own" ? await goalShares(ctx) : []),
    origin: input.origin,
    createdOn: ctx.asOf,
  };
  await save(ctx, [plan, ...plans]);
  await recordUsage("plan", "created", ctx.locale);
  return plan;
}

export async function updatePlan(
  ctx: SessionContext,
  id: string,
  change: { name: string; split: Split },
): Promise<Plan | PlanError> {
  if (!isValidSplit(change.split)) return "invalid_split";
  if (nameCarriesAmount(change.name)) return "name_has_amount";
  const plans = await listPlans(ctx);
  const current = plans.find((plan) => plan.id === id);
  if (!current) return "not_found";
  const next: Plan = { ...current, name: change.name.trim().slice(0, 60), split: change.split };
  await save(
    ctx,
    plans.map((plan) => (plan.id === id ? next : plan)),
  );
  // A shared plan stays in step with its owner's edits.
  if (next.shareCode) await publish(next, next.shareCode, Boolean(next.shareListed), true);
  return next;
}

/** Moves a plan to the recycle bin. Sharing stops at once: a binned plan is not left public. */
export async function deletePlan(ctx: SessionContext, id: string): Promise<boolean> {
  const plans = await listPlans(ctx);
  const plan = plans.find((candidate) => candidate.id === id);
  if (!plan) return false;
  if (plan.shareCode) await withdraw(plan.shareCode);
  const { shareCode: _code, shareListed: _listed, ...kept } = plan;
  void _code;
  void _listed;
  await save(
    ctx,
    plans.filter((candidate) => candidate.id !== id),
  );
  await addToTrash(ctx.customerRef, [
    {
      id: `trash-${crypto.randomUUID()}`,
      kind: "plan",
      deletedAt: new Date().toISOString(),
      label: plan.name,
      item: kept,
    },
  ]);
  return true;
}

export async function restorePlan(ctx: SessionContext, plan: Plan): Promise<void> {
  const plans = await listPlans(ctx);
  if (!plans.some((candidate) => candidate.id === plan.id)) await save(ctx, [plan, ...plans]);
}

/** Follows one plan (or none): only one plan is followed at a time. */
export async function trackPlan(ctx: SessionContext, id: string | null): Promise<boolean> {
  const plans = await listPlans(ctx);
  if (id && !plans.some((plan) => plan.id === id)) return false;
  await save(
    ctx,
    plans.map((plan) => ({ ...plan, tracked: plan.id === id ? true : undefined })),
  );
  return true;
}

// ---- Sharing ----

/** Eight characters from an alphabet without look-alikes, so a code can be read out or typed. */
function newCode(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from(randomBytes(8), (byte) => alphabet[byte % alphabet.length]).join("");
}

export const normaliseCode = (code: string): string =>
  code
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 8);

async function publish(
  plan: Plan,
  code: string,
  listed: boolean,
  showGoalNames: boolean,
): Promise<void> {
  const content = {
    name: plan.name,
    split: plan.split,
    goals: plan.goals.map((goal, index) => ({
      label: showGoalNames ? goal.label : `#${index + 1}`,
      percent: goal.percent,
    })),
  };
  const db = await getDb();
  await db.query(
    `INSERT INTO shared_plans (code, sealed_plan, listed) VALUES ($1, $2, $3)
     ON CONFLICT (code) DO UPDATE SET sealed_plan = EXCLUDED.sealed_plan, listed = EXCLUDED.listed, updated_at = now()`,
    [code, encryptField(JSON.stringify(content), key(), aad(code)), listed],
  );
}

async function withdraw(code: string): Promise<void> {
  const db = await getDb();
  await db.query("DELETE FROM shared_plans WHERE code = $1", [code]);
}

/**
 * Shares a plan. `listed` also shows it in the public list; otherwise only
 * people given the code can open it. Goal names are replaced by numbers
 * unless the customer chooses to show them.
 */
export async function sharePlan(
  ctx: SessionContext,
  id: string,
  options: { listed: boolean; showGoalNames: boolean },
): Promise<Plan | PlanError> {
  const plans = await listPlans(ctx);
  const plan = plans.find((candidate) => candidate.id === id);
  if (!plan) return "not_found";
  const code = plan.shareCode ?? newCode();
  const shared: Plan = { ...plan, shareCode: code, shareListed: options.listed };
  // What is published keeps the goal names only if asked; the owner's own copy keeps them always.
  await publish(plan, code, options.listed, options.showGoalNames);
  await save(
    ctx,
    plans.map((candidate) => (candidate.id === id ? shared : candidate)),
  );
  await recordUsage("plan", options.listed ? "shared_public" : "shared_code", ctx.locale);
  return shared;
}

export async function unsharePlan(ctx: SessionContext, id: string): Promise<boolean> {
  const plans = await listPlans(ctx);
  const plan = plans.find((candidate) => candidate.id === id);
  if (!plan) return false;
  if (plan.shareCode) await withdraw(plan.shareCode);
  await save(
    ctx,
    plans.map((candidate) => {
      if (candidate.id !== id) return candidate;
      const { shareCode: _code, shareListed: _listed, ...rest } = candidate;
      void _code;
      void _listed;
      return rest;
    }),
  );
  return true;
}

type SharedRow = { code: string; sealed_plan: string; listed: boolean; copies: number | string };

function open(row: SharedRow): PublicPlan {
  const content = JSON.parse(decryptField(row.sealed_plan, key(), aad(row.code))) as Pick<
    PublicPlan,
    "name" | "split" | "goals"
  >;
  return { code: row.code, ...content, listed: row.listed, copies: Number(row.copies) };
}

export async function sharedPlan(code: string): Promise<PublicPlan | null> {
  const db = await getDb();
  const rows = await db.query<SharedRow>(
    "SELECT code, sealed_plan, listed, copies FROM shared_plans WHERE code = $1",
    [normaliseCode(code)],
  );
  return rows[0] ? open(rows[0]) : null;
}

/** Plans their owners chose to list publicly, most copied first. */
export async function listedPlans(limit = 12): Promise<PublicPlan[]> {
  const db = await getDb();
  const rows = await db.query<SharedRow>(
    "SELECT code, sealed_plan, listed, copies FROM shared_plans WHERE listed ORDER BY copies DESC, created_at DESC LIMIT $1",
    [limit],
  );
  return rows.map(open);
}

/** Everything shared, for staff moderation. */
export async function allSharedPlans(): Promise<PublicPlan[]> {
  const db = await getDb();
  const rows = await db.query<SharedRow>(
    "SELECT code, sealed_plan, listed, copies FROM shared_plans ORDER BY created_at DESC LIMIT 200",
  );
  return rows.map(open);
}

/** Staff removal of a shared plan. The owner keeps their own plan; it is simply no longer shared. */
export const removeSharedPlan = withdraw;

/** Adds someone else's shared plan to the customer's own plans. */
export async function copyPlan(ctx: SessionContext, code: string): Promise<Plan | PlanError> {
  const shared = await sharedPlan(code);
  if (!shared) return "not_found";
  const plan = await createPlan(ctx, {
    name: shared.name,
    split: shared.split,
    goals: shared.goals,
    origin: "copied",
  });
  if (typeof plan === "string") return plan;
  const db = await getDb();
  await db.query("UPDATE shared_plans SET copies = copies + 1 WHERE code = $1", [shared.code]);
  await recordUsage("plan", "copied", ctx.locale);
  return plan;
}

/** Clears share marks whose public record no longer exists (for example after staff removed it). */
export async function reconcileShares(ctx: SessionContext, plans: Plan[]): Promise<Plan[]> {
  let changed = false;
  const next: Plan[] = [];
  for (const plan of plans) {
    if (plan.shareCode && !(await sharedPlan(plan.shareCode))) {
      const { shareCode: _code, shareListed: _listed, ...rest } = plan;
      void _code;
      void _listed;
      next.push(rest);
      changed = true;
    } else next.push(plan);
  }
  if (changed) await save(ctx, next);
  return next;
}
