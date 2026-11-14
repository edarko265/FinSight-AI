import { getSettings } from "@/lib/admin/settings";
import { buildRewards } from "@/lib/coach/advice";
import {
  getSessionContext,
  termsRequired,
  unauthorized,
  type SessionContext,
} from "@/lib/coach/context";
import { clearVoucherPick, readVoucherPick, writeVoucherPick } from "@/lib/coach/vouchers";
import { canSelect } from "@/lib/analytics/vouchers";
import { voucherSelectionSchema } from "@/lib/contracts/rewards";

/** The signed-in customer's voucher ladder, or the response to send instead. */
async function ladderFor(ctx: SessionContext) {
  const settings = await getSettings();
  if (!settings.features.rewards) return null;
  const pick = await readVoucherPick(ctx.customerRef, ctx.asOf);
  return buildRewards(ctx, 0, settings.rewards, pick).vouchers;
}

/** Picks a voucher for the evaluated month. The tier must be unlocked; picking again replaces it. */
export async function POST(request: Request): Promise<Response> {
  const ctx = await getSessionContext();
  if (!ctx) return unauthorized();
  const blocked = await termsRequired(ctx);
  if (blocked) return blocked;
  const parsed = voucherSelectionSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "invalid_request" }, { status: 400 });
  const ladder = await ladderFor(ctx);
  if (!ladder) return Response.json({ error: "not_found" }, { status: 404 });
  const { tierId, optionId } = parsed.data;
  if (!canSelect(ladder, tierId, optionId)) {
    return Response.json({ error: "locked" }, { status: 409 });
  }
  await writeVoucherPick(ctx.customerRef, { month: ladder.month, tierId, optionId });
  return Response.json(await ladderFor(ctx));
}

/** Removes the pick for the evaluated month. */
export async function DELETE(): Promise<Response> {
  const ctx = await getSessionContext();
  if (!ctx) return unauthorized();
  const blocked = await termsRequired(ctx);
  if (blocked) return blocked;
  if (!(await ladderFor(ctx))) return Response.json({ error: "not_found" }, { status: 404 });
  await clearVoucherPick(ctx.customerRef);
  return Response.json(await ladderFor(ctx));
}
