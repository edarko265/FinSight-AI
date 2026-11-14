import { z } from "zod";

import { getSettings } from "@/lib/admin/settings";
import { recordUsage } from "@/lib/admin/usage";
import { getSessionContext, termsRequired, unauthorized } from "@/lib/coach/context";
import {
  addFriend,
  friendCode,
  friendsWithPlans,
  removeFriend,
  renameFriend,
} from "@/lib/coach/friends";
import { rateLimit } from "@/lib/security/session";

/** The customer's friend code and their friends, each with the plans that friend has shared. */
export async function GET(): Promise<Response> {
  const ctx = await getSessionContext();
  if (!ctx) return unauthorized();
  const blocked = await termsRequired(ctx);
  if (blocked) return blocked;
  if (!(await getSettings()).features.sharing) {
    return Response.json({ sharing: false, code: null, friends: [] });
  }
  return Response.json({
    sharing: true,
    code: await friendCode(ctx.customerRef),
    friends: await friendsWithPlans(ctx.customerRef),
  });
}

const nickname = z.string().trim().min(1).max(40);
const body = z.discriminatedUnion("action", [
  z.object({ action: z.literal("add"), code: z.string().min(4).max(20), nickname }),
  z.object({ action: z.literal("rename"), id: z.string().min(1).max(80), nickname }),
  z.object({ action: z.literal("remove"), id: z.string().min(1).max(80) }),
]);

export async function POST(request: Request): Promise<Response> {
  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "invalid_request" }, { status: 400 });
  const ctx = await getSessionContext();
  if (!ctx) return unauthorized();
  const blocked = await termsRequired(ctx);
  if (blocked) return blocked;
  if (!(await getSettings()).features.sharing) {
    return Response.json({ error: "sharing_off" }, { status: 403 });
  }
  const input = parsed.data;
  if (input.action === "add") {
    // Codes are random; looking them up is limited so they cannot be guessed in bulk.
    if (!(await rateLimit(`friend-code:${ctx.customerRef}`, 10, 60_000))) {
      return Response.json({ error: "too_many_attempts" }, { status: 429 });
    }
    const result = await addFriend(ctx.customerRef, input.code, input.nickname, ctx.asOf);
    if (typeof result === "string") {
      return Response.json({ error: result }, { status: result === "not_found" ? 404 : 400 });
    }
    await recordUsage("friend", "added", ctx.locale);
    return Response.json({ ok: true });
  }
  const ok =
    input.action === "rename"
      ? await renameFriend(ctx.customerRef, input.id, input.nickname)
      : await removeFriend(ctx.customerRef, input.id);
  return ok ? Response.json({ ok: true }) : Response.json({ error: "not_found" }, { status: 404 });
}
