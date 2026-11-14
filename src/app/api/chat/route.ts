import { z } from "zod";

import { OUTSIDE_THEMES, themeOf } from "@/lib/admin/themes";
import { recordUsage } from "@/lib/admin/usage";
import { answerQuestion } from "@/lib/coach/answer";
import { appendExchange } from "@/lib/coach/chat-history";
import { hasAiConsent } from "@/lib/coach/consent";
import { getSessionContext, termsRequired, unauthorized } from "@/lib/coach/context";
import { rateLimit } from "@/lib/security/session";

const body = z.object({
  message: z.string().trim().min(1).max(4000),
  locale: z.string().optional(),
  remember: z.boolean().optional(),
  history: z
    .array(z.object({ role: z.enum(["user", "assistant"]), text: z.string().max(4000) }))
    .max(20)
    .optional(),
});

/** The model or speech provider can take a while; allow for it on serverless hosts. */
export const maxDuration = 60;

export async function POST(request: Request): Promise<Response> {
  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "invalid_request" }, { status: 400 });

  const ctx = await getSessionContext(parsed.data.locale);
  if (!ctx) return unauthorized();
  const blocked = await termsRequired(ctx);
  if (blocked) return blocked;
  if (!(await rateLimit(`chat:${ctx.customerRef}`, 20, 60_000))) {
    return Response.json({ error: "rate_limited" }, { status: 429 });
  }
  const allowModel = hasAiConsent(ctx.consent);
  const { message, topic } = await answerQuestion(
    ctx,
    parsed.data.message,
    parsed.data.history ?? [],
    {
      allowModel,
    },
  );
  // Kept for the customer, sealed with their key, unless this is a one-off (the new-widget sheet).
  if (parsed.data.remember !== false) {
    await appendExchange(ctx.customerRef, parsed.data.message, message).catch(() => undefined);
  }
  await recordUsage("question", topic, ctx.locale, message.mode ?? "basic");
  // What customers ask for that the coach has no calculation for. Only the broad theme is
  // counted; the question itself is not stored. A question answered with what staff taught
  // the coach is no longer a gap.
  const theme = themeOf(parsed.data.message);
  if (
    topic !== "taught" &&
    topic !== "mortgage" &&
    (topic === "none" || topic === "conversation" || OUTSIDE_THEMES.has(theme))
  ) {
    await recordUsage("unanswered", theme, ctx.locale, message.mode ?? "basic");
  }
  return Response.json(message);
}
