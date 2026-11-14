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
import { listPayments, pay, paymentProvider } from "@/lib/payments/payments";
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
    payments: await listPayments(ctx.customerRef),
    paymentsSimulated: paymentProvider().simulated,
  });
}

const body = z.object({
  topic: z.enum(ADVISOR_TOPICS),
  slot: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/),
  note: z.string().trim().max(1000).default(""),
  /** The customer confirmed the fee on the payment step. */
  pay: z.boolean().optional(),
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
  // A conversation after the first has a fee, which is paid before the request is made.
  // Payment is simulated in this prototype: no card is asked for and nothing is charged.
  const feeCents = await nextFeeCents(ctx.customerRef);
  const alreadyOpen = await currentRequest(ctx.customerRef);
  let payment = null;
  if (feeCents > 0 && !alreadyOpen) {
    if (!parsed.data.pay) {
      return Response.json({ error: "payment_required", feeCents }, { status: 402 });
    }
    payment = await pay(ctx.customerRef, "adviser", feeCents);
    await recordUsage("payment", "adviser", ctx.locale);
  }
  const created = await createRequest(ctx.customerRef, parsed.data);
  await recordUsage("advisor", parsed.data.topic, ctx.locale);
  return Response.json({ request: created, payment });
}
