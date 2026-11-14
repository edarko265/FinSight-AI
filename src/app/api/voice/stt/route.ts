import { getSettings } from "@/lib/admin/settings";
import { recordUsage } from "@/lib/admin/usage";
import { hasAiConsent, readConsent } from "@/lib/coach/consent";
import { getSessionContext, termsRequired, unauthorized } from "@/lib/coach/context";
import { rateLimit } from "@/lib/security/session";
import { transcribeSpeech } from "@/lib/voice/elevenlabs";

const MAX_BYTES = 5 * 1024 * 1024;

/** The model or speech provider can take a while; allow for it on serverless hosts. */
export const maxDuration = 60;

export async function POST(request: Request): Promise<Response> {
  const form = await request.formData().catch(() => null);
  const audio = form?.get("audio");
  if (!(audio instanceof Blob) || audio.size === 0 || audio.size > MAX_BYTES) {
    return Response.json({ error: "invalid_request" }, { status: 400 });
  }
  const ctx = await getSessionContext(form?.get("locale"));
  if (!ctx) return unauthorized();
  const blocked = await termsRequired(ctx);
  if (blocked) return blocked;
  // Speech goes to an outside provider, so it needs the same consent as the AI coach.
  if (!hasAiConsent(await readConsent(ctx.customerRef))) {
    return Response.json({ error: "consent_required" }, { status: 403 });
  }
  if (!(await rateLimit(`stt:${ctx.customerRef}`, 20, 60_000))) {
    return Response.json({ error: "rate_limited" }, { status: 429 });
  }
  if (!(await getSettings()).features.voice) {
    return Response.json({ error: "voice_unavailable" }, { status: 503 });
  }
  await recordUsage("voice", "listen", ctx.locale);
  try {
    return Response.json({ text: await transcribeSpeech(audio, ctx.locale) });
  } catch (error) {
    console.error(
      "voice: transcription unavailable:",
      error instanceof Error ? error.message : "error",
    );
    return Response.json({ error: "voice_unavailable" }, { status: 503 });
  }
}
