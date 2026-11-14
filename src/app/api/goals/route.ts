import { z } from "zod";

import { getSettings } from "@/lib/admin/settings";
import { buildRecommendations, buildRewards, safeToSave } from "@/lib/coach/advice";
import { getSessionContext, termsRequired, unauthorized } from "@/lib/coach/context";
import { deleteGoal, listGoalPlans, setGoal, updateGoal } from "@/lib/coach/goals";

/** The customer's goals with their funding plans, their rewards and current recommendations. */
export async function GET(request: Request): Promise<Response> {
  const ctx = await getSessionContext(new URL(request.url).searchParams.get("locale"));
  if (!ctx) return unauthorized();
  const blocked = await termsRequired(ctx);
  if (blocked) return blocked;
  const plans = await listGoalPlans(ctx);
  const settings = await getSettings();
  return Response.json({
    goals: plans,
    rewards: settings.features.rewards ? buildRewards(ctx, plans.length, settings.rewards) : null,
    recommendations: buildRecommendations(ctx),
    // What could be set aside now while the next month stays covered.
    safeToSave: safeToSave(ctx).safeCents,
    setAsideCents: ctx.record.earmarkedCents ?? 0,
  });
}

const body = z.object({ id: z.string().min(1).max(80) });

export async function DELETE(request: Request): Promise<Response> {
  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "invalid_request" }, { status: 400 });
  const ctx = await getSessionContext();
  if (!ctx) return unauthorized();
  const blocked = await termsRequired(ctx);
  if (blocked) return blocked;
  await deleteGoal(ctx, parsed.data.id);
  return Response.json({ ok: true });
}

const patch = z.object({
  id: z.string().min(1).max(80),
  name: z.string().trim().min(1).max(60).optional(),
  targetCents: z.number().int().min(100).max(100_000_000).optional(),
  months: z.number().int().min(1).max(120).optional(),
});

/** Edits a goal. */
export async function PATCH(request: Request): Promise<Response> {
  const parsed = patch.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "invalid_request" }, { status: 400 });
  const ctx = await getSessionContext();
  if (!ctx) return unauthorized();
  const blocked = await termsRequired(ctx);
  if (blocked) return blocked;
  const { id, ...changes } = parsed.data;
  if (!(await updateGoal(ctx, id, changes)))
    return Response.json({ error: "not_found" }, { status: 404 });
  return Response.json({ ok: true });
}

const create = z.object({
  name: z.string().trim().min(1).max(60),
  targetCents: z.number().int().min(100).max(100_000_000),
  months: z.number().int().min(1).max(120),
  /** How long ago the customer started saving towards it. 0 or left out means now. */
  startedMonthsAgo: z.number().int().min(0).max(36).optional(),
});

/** Creates a goal from the form. Goals can also be created by describing them to the coach. */
export async function POST(request: Request): Promise<Response> {
  const parsed = create.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "invalid_request" }, { status: 400 });
  const ctx = await getSessionContext();
  if (!ctx) return unauthorized();
  const blocked = await termsRequired(ctx);
  if (blocked) return blocked;
  await setGoal(ctx, parsed.data);
  return Response.json({ ok: true });
}
