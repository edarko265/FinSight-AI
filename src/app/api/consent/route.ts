import { z } from "zod";

import { recordUsage } from "@/lib/admin/usage";
import {
  acceptTerms,
  AI_TERMS_VERSION,
  hasAcceptedTerms,
  hasAiConsent,
  hasDecidedOnAi,
  readConsent,
  setAiConsent,
  TERMS_VERSION,
  type ConsentRecord,
} from "@/lib/coach/consent";
import { getSessionContext, unauthorized } from "@/lib/coach/context";

function describe(record: ConsentRecord) {
  return {
    termsVersion: TERMS_VERSION,
    aiTermsVersion: AI_TERMS_VERSION,
    termsAccepted: hasAcceptedTerms(record),
    accepted: hasAiConsent(record),
    aiDecided: hasDecidedOnAi(record),
    termsAcceptedAt: record.termsAcceptedAt,
    acceptedAt: record.acceptedAt,
    withdrawnAt: record.withdrawnAt,
  };
}

export async function GET(): Promise<Response> {
  const ctx = await getSessionContext();
  if (!ctx) return unauthorized();
  return Response.json(describe(await readConsent(ctx.customerRef)));
}

const body = z
  .object({
    /** Accepts the terms of use and the privacy notice. Cannot be un-set here; erasing data does that. */
    terms: z.literal(true).optional(),
    /** The optional choice about AI processing. */
    accepted: z.boolean().optional(),
  })
  .refine((value) => value.terms !== undefined || value.accepted !== undefined);

/** Records the customer's choices. Each is timestamped. */
export async function POST(request: Request): Promise<Response> {
  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "invalid_request" }, { status: 400 });
  const ctx = await getSessionContext();
  if (!ctx) return unauthorized();

  let record = await readConsent(ctx.customerRef);
  if (parsed.data.terms) {
    record = await acceptTerms(ctx.customerRef);
    await recordUsage("consent", "terms", ctx.locale);
  }
  if (parsed.data.accepted !== undefined) {
    // AI processing can only be switched on once the terms are accepted.
    if (parsed.data.accepted && !hasAcceptedTerms(record)) {
      return Response.json({ error: "terms_required" }, { status: 403 });
    }
    record = await setAiConsent(ctx.customerRef, parsed.data.accepted);
    await recordUsage("consent", parsed.data.accepted ? "accepted" : "withdrawn", ctx.locale);
  }
  return Response.json(describe(record));
}
