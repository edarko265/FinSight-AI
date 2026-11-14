import { z } from "zod";

import { getSessionContext, termsRequired, unauthorized } from "@/lib/coach/context";
import { translate } from "@/lib/i18n/translate";
import {
  addSubscription,
  listSubscriptions,
  pushPublicKey,
  pushToCustomer,
  removeSubscription,
} from "@/lib/push/push";

/** Whether notifications are available, the key a browser needs to subscribe, and how many devices are on. */
export async function GET(): Promise<Response> {
  const ctx = await getSessionContext();
  if (!ctx) return unauthorized();
  const blocked = await termsRequired(ctx);
  if (blocked) return blocked;
  return Response.json({
    publicKey: pushPublicKey(),
    devices: (await listSubscriptions(ctx.customerRef)).length,
  });
}

const subscription = z.object({
  endpoint: z.string().url().max(1000),
  expirationTime: z.number().nullable().optional(),
  keys: z.object({ p256dh: z.string().min(1).max(200), auth: z.string().min(1).max(100) }),
});

/** Turns notifications on for this device and sends a short confirmation to it. */
export async function POST(request: Request): Promise<Response> {
  const parsed = subscription.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "invalid_request" }, { status: 400 });
  const ctx = await getSessionContext();
  if (!ctx) return unauthorized();
  const blocked = await termsRequired(ctx);
  if (blocked) return blocked;
  if (!pushPublicKey()) return Response.json({ error: "unavailable" }, { status: 503 });

  await addSubscription(ctx.customerRef, {
    endpoint: parsed.data.endpoint,
    keys: parsed.data.keys,
  });
  await pushToCustomer(ctx.customerRef, {
    title: translate(ctx.locale, "notify.welcome.title"),
    body: translate(ctx.locale, "notify.welcome.body"),
    url: "/insights",
    tag: "welcome",
  });
  return Response.json({ ok: true });
}

const removal = z.object({ endpoint: z.string().url().max(1000) });

/** Turns notifications off for this device. */
export async function DELETE(request: Request): Promise<Response> {
  const parsed = removal.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "invalid_request" }, { status: 400 });
  const ctx = await getSessionContext();
  if (!ctx) return unauthorized();
  await removeSubscription(ctx.customerRef, parsed.data.endpoint);
  return Response.json({ ok: true });
}
