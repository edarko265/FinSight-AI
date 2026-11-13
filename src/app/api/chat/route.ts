import { z } from "zod";

import { answerQuestion } from "@/lib/coach/answer";
import { hasAiConsent, readConsent } from "@/lib/coach/consent";
import { getSessionContext, unauthorized } from "@/lib/coach/context";
import { rateLimit } from "@/lib/security/session";

const body = z.object({
  message: z.string().trim().min(1).max(4000),
  locale: z.string().optional(),
  history: z
    .array(z.object({ role: z.enum(["user", "assistant"]), text: z.string().max(4000) }))
    .max(20)
    .optional(),
});

export async function POST(request: Request): Promise<Response> {
  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "invalid_request" }, { status: 400 });

  const ctx = await getSessionContext(parsed.data.locale);
  if (!ctx) return unauthorized();
  if (!rateLimit(`chat:${ctx.customerRef}`, 20, 60_000)) {
    return Response.json({ error: "rate_limited" }, { status: 429 });
  }
  const allowModel = hasAiConsent(await readConsent(ctx.customerRef));
  const message = await answerQuestion(ctx, parsed.data.message, parsed.data.history ?? [], {
    allowModel,
  });
  return Response.json(message);
}
