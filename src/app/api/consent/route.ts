import { z } from "zod";

import { recordUsage } from "@/lib/admin/usage";
import { AI_TERMS_VERSION, hasAiConsent, readConsent, setAiConsent } from "@/lib/coach/consent";
import { getSessionContext, unauthorized } from "@/lib/coach/context";

export async function GET(): Promise<Response> {
  const ctx = await getSessionContext();
  if (!ctx) return unauthorized();
  const record = await readConsent(ctx.customerRef);
  return Response.json({
    termsVersion: AI_TERMS_VERSION,
    accepted: hasAiConsent(record),
    ...record,
  });
}

const body = z.object({ accepted: z.boolean() });

/** Records the user's choice. Accepting and withdrawing are both timestamped. */
export async function POST(request: Request): Promise<Response> {
  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "invalid_request" }, { status: 400 });
  const ctx = await getSessionContext();
  if (!ctx) return unauthorized();
  const record = await setAiConsent(ctx.customerRef, parsed.data.accepted);
  await recordUsage("consent", parsed.data.accepted ? "accepted" : "withdrawn", ctx.locale);
  return Response.json({
    termsVersion: AI_TERMS_VERSION,
    accepted: hasAiConsent(record),
    ...record,
  });
}
