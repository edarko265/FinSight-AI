import { z } from "zod";

import { buildRecommendations, buildRewards } from "@/lib/coach/advice";
import { getSessionContext, unauthorized } from "@/lib/coach/context";
import { deleteGoal, listGoalPlans } from "@/lib/coach/goals";

/** The customer's goals with their funding plans, their rewards and current recommendations. */
export async function GET(request: Request): Promise<Response> {
  const ctx = await getSessionContext(new URL(request.url).searchParams.get("locale"));
  if (!ctx) return unauthorized();
  const plans = await listGoalPlans(ctx);
  return Response.json({
    goals: plans,
    rewards: buildRewards(ctx, plans.length),
    recommendations: buildRecommendations(ctx),
  });
}

const body = z.object({ id: z.string().min(1).max(80) });

export async function DELETE(request: Request): Promise<Response> {
  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "invalid_request" }, { status: 400 });
  const ctx = await getSessionContext();
  if (!ctx) return unauthorized();
  await deleteGoal(ctx, parsed.data.id);
  return Response.json({ ok: true });
}
