import { z } from "zod";

import { getSettings } from "@/lib/admin/settings";
import { recordUsage } from "@/lib/admin/usage";
import {
  ADVISOR_TOPICS,
  callSlots,
  createRequest,
  currentRequest,
  nextFeeCents,
} from "@/lib/advisor/handoff";
import { getSessionContext, termsRequired, unauthorized } from "@/lib/coach/context";

/** The customer's current adviser conversation, the available call times and what the next request costs. */
export async function GET(): Promise<Response> {
  const ctx = await getSessionContext();
  if (!ctx) return unauthorized();
  const blocked = await termsRequired(ctx);
  if (blocked) return blocked;
  return Response.json({
    request: await currentRequest(ctx.customerRef),
    slots: callSlots(ctx.asOf),
    nextFeeCents: await nextFeeCents(ctx.customerRef),
  });
}

const body = z.object({
  topic: z.enum(ADVISOR_TOPICS),
  slot: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/),
  note: z.string().trim().max(1000).default(""),
});

export async function POST(request: Request): Promise<Response> {
  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "invalid_request" }, { status: 400 });
  const ctx = await getSessionContext();
  if (!ctx) return unauthorized();
  const blocked = await termsRequired(ctx);
  if (blocked) return blocked;
  if (!(await getSettings()).features.advisor) {
    return Response.json({ error: "unavailable" }, { status: 503 });
  }
  if (!callSlots(ctx.asOf).includes(parsed.data.slot)) {
    return Response.json({ error: "invalid_request" }, { status: 400 });
  }
  const created = await createRequest(ctx.customerRef, parsed.data);
  await recordUsage("advisor", parsed.data.topic, ctx.locale);
  return Response.json({ request: created });
}
