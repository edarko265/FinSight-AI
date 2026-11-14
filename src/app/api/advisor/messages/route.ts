import { z } from "zod";

import { customerReply } from "@/lib/advisor/handoff";
import { getSessionContext, termsRequired, unauthorized } from "@/lib/coach/context";
import { rateLimit } from "@/lib/security/session";

const body = z.object({ text: z.string().trim().min(1).max(2000) });

export async function POST(request: Request): Promise<Response> {
  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "invalid_request" }, { status: 400 });
  const ctx = await getSessionContext();
  if (!ctx) return unauthorized();
  const blocked = await termsRequired(ctx);
  if (blocked) return blocked;
  if (!rateLimit(`advisor:${ctx.customerRef}`, 30, 60_000)) {
    return Response.json({ error: "rate_limited" }, { status: 429 });
  }
  const updated = await customerReply(ctx.customerRef, parsed.data.text);
  if (!updated) return Response.json({ error: "no_request" }, { status: 404 });
  return Response.json({ request: updated });
}
