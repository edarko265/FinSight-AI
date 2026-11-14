import { z } from "zod";

import { recordUsage } from "@/lib/admin/usage";
import { hasAiConsent, readConsent } from "@/lib/coach/consent";
import { getSessionContext, unauthorized } from "@/lib/coach/context";
import { rateLimit } from "@/lib/security/session";
import { synthesizeSpeech } from "@/lib/voice/elevenlabs";

const body = z.object({ text: z.string().trim().min(1).max(1500), locale: z.string().optional() });

export async function POST(request: Request): Promise<Response> {
  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "invalid_request" }, { status: 400 });
  const ctx = await getSessionContext(parsed.data.locale);
  if (!ctx) return unauthorized();
  // Speech goes to an outside provider, so it needs the same consent as the AI coach.
  if (!hasAiConsent(await readConsent(ctx.customerRef))) {
    return Response.json({ error: "consent_required" }, { status: 403 });
  }
  if (!rateLimit(`tts:${ctx.customerRef}`, 30, 60_000)) {
    return Response.json({ error: "rate_limited" }, { status: 429 });
  }
  await recordUsage("voice", "speak", ctx.locale);
  try {
    const speech = await synthesizeSpeech(parsed.data.text, ctx.locale);
    return new Response(speech.body, {
      headers: { "Content-Type": "audio/mpeg", "Cache-Control": "no-store" },
    });
  } catch (error) {
    console.error("voice: speech unavailable:", error instanceof Error ? error.message : "error");
    return Response.json({ error: "voice_unavailable" }, { status: 503 });
  }
}
