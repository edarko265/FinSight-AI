import { z } from "zod";

import { getSettings } from "@/lib/admin/settings";
import { recordUsage } from "@/lib/admin/usage";
import { buildRewards } from "@/lib/coach/advice";
import { listRedemptions, redeem } from "@/lib/coach/bonus";
import { getSessionContext, termsRequired, unauthorized } from "@/lib/coach/context";
import { listGoals } from "@/lib/coach/goals";

/** The rewards the customer has redeemed. */
export async function GET(): Promise<Response> {
  const ctx = await getSessionContext();
  if (!ctx) return unauthorized();
  const blocked = await termsRequired(ctx);
  if (blocked) return blocked;
  return Response.json({ redemptions: await listRedemptions(ctx.customerRef) });
}

const body = z.object({ couponId: z.enum(["coffee", "groceries", "voucher"]) });

/** Redeems an unlocked reward through the bonus programme, which is simulated here. */
export async function POST(request: Request): Promise<Response> {
  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "invalid_request" }, { status: 400 });
  const ctx = await getSessionContext();
  if (!ctx) return unauthorized();
  const blocked = await termsRequired(ctx);
  if (blocked) return blocked;
  const settings = await getSettings();
  if (!settings.features.rewards) return Response.json({ error: "unavailable" }, { status: 503 });
  // The points are worked out again here: what the browser says it has earned is not trusted.
  const rewards = buildRewards(ctx, (await listGoals(ctx)).length, settings.rewards);
  const coupon = rewards.coupons.find((item) => item.id === parsed.data.couponId);
  if (!coupon?.unlocked) return Response.json({ error: "locked" }, { status: 400 });
  const result = await redeem(ctx.customerRef, parsed.data.couponId, ctx.asOf);
  if (result === "already") return Response.json({ error: "already" }, { status: 400 });
  await recordUsage("reward", parsed.data.couponId, ctx.locale);
  return Response.json({ redemption: result });
}
