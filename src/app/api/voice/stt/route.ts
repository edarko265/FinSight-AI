import { getSessionContext, unauthorized } from "@/lib/coach/context";
import { rateLimit } from "@/lib/security/session";
import { transcribeSpeech } from "@/lib/voice/elevenlabs";

const MAX_BYTES = 5 * 1024 * 1024;

export async function POST(request: Request): Promise<Response> {
  const form = await request.formData().catch(() => null);
  const audio = form?.get("audio");
  if (!(audio instanceof Blob) || audio.size === 0 || audio.size > MAX_BYTES) {
    return Response.json({ error: "invalid_request" }, { status: 400 });
  }
  const ctx = await getSessionContext(form?.get("locale"));
  if (!ctx) return unauthorized();
  if (!rateLimit(`stt:${ctx.customerRef}`, 20, 60_000)) {
    return Response.json({ error: "rate_limited" }, { status: 429 });
  }
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
