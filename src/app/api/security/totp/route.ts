import { z } from "zod";

import { getSessionContext, termsRequired, unauthorized } from "@/lib/coach/context";
import { rateLimit } from "@/lib/security/session";
import {
  beginTwoStep,
  confirmTwoStep,
  disableTwoStep,
  twoStepEnabled,
} from "@/lib/security/two-step";

export async function GET(): Promise<Response> {
  const ctx = await getSessionContext();
  if (!ctx) return unauthorized();
  return Response.json({ enabled: await twoStepEnabled(ctx.customerRef) });
}

const body = z.discriminatedUnion("action", [
  z.object({ action: z.literal("begin") }),
  z.object({ action: z.literal("confirm"), code: z.string().min(6).max(10) }),
  z.object({ action: z.literal("disable"), code: z.string().min(6).max(10) }),
]);

/** Sets up, confirms or switches off two-step sign-in for the signed-in customer. */
export async function POST(request: Request): Promise<Response> {
  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "invalid_request" }, { status: 400 });
  const ctx = await getSessionContext();
  if (!ctx) return unauthorized();
  const blocked = await termsRequired(ctx);
  if (blocked) return blocked;
  if (!(await rateLimit(`totp:${ctx.customerRef}`, 8, 60_000))) {
    return Response.json({ error: "too_many_attempts" }, { status: 429 });
  }
  const input = parsed.data;
  if (input.action === "begin") {
    return Response.json(await beginTwoStep(ctx.customerRef, ctx.record.profile.customerId));
  }
  const ok =
    input.action === "confirm"
      ? await confirmTwoStep(ctx.customerRef, input.code)
      : await disableTwoStep(ctx.customerRef, input.code);
  return ok
    ? Response.json({ enabled: input.action === "confirm" })
    : Response.json({ error: "wrong_code" }, { status: 400 });
}
