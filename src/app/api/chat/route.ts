import { z } from "zod";

import { themeOf } from "@/lib/admin/themes";
import { recordUsage } from "@/lib/admin/usage";
import { answerQuestion } from "@/lib/coach/answer";
import { hasAiConsent, readConsent } from "@/lib/coach/consent";
import { getSessionContext, unauthorized } from "@/lib/coach/context";
import { rateLimit } from "@/lib/security/session";

/** Subjects the coach cannot calculate, whatever tool the model reached for. */
const OUTSIDE_THEMES = new Set([
  "loans",
  "investing",
  "insurance",
  "cards",
  "taxes",
  "pension",
  "benefits",
  "account",
]);

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
  const { message, topic } = await answerQuestion(
    ctx,
    parsed.data.message,
    parsed.data.history ?? [],
    {
      allowModel,
    },
  );
  await recordUsage("question", topic, ctx.locale, message.mode ?? "basic");
  // What customers ask for that the coach has no calculation for. Only the broad theme is
  // counted; the question itself is not stored.
  const theme = themeOf(parsed.data.message);
  if (topic === "none" || topic === "conversation" || OUTSIDE_THEMES.has(theme)) {
    await recordUsage("unanswered", theme, ctx.locale, message.mode ?? "basic");
  }
  return Response.json(message);
}
