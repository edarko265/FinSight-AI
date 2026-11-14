import { getSettings } from "@/lib/admin/settings";
import { recordUsage } from "@/lib/admin/usage";
import { hasAiConsent, readConsent } from "@/lib/coach/consent";
import { getSessionContext, unauthorized } from "@/lib/coach/context";
import { getEnv } from "@/lib/env";
import { rateLimit } from "@/lib/security/session";

/**
 * Starts a realtime voice call: returns a short-lived signed address for the
 * voice agent. The API key stays on the server, and the agent itself has no
 * access to data: it asks the customer's own browser, which asks our coach.
 */
export async function GET(): Promise<Response> {
  const ctx = await getSessionContext();
  if (!ctx) return unauthorized();
  const env = getEnv();
  const settings = await getSettings();
  if (!settings.features.voice || !env.ELEVENLABS_API_KEY || !env.ELEVENLABS_AGENT_ID) {
    return Response.json({ error: "voice_unavailable" }, { status: 503 });
  }
  if (!hasAiConsent(await readConsent(ctx.customerRef))) {
    return Response.json({ error: "consent_required" }, { status: 403 });
  }
  if (!rateLimit(`call:${ctx.customerRef}`, 6, 60_000)) {
    return Response.json({ error: "rate_limited" }, { status: 429 });
  }
  const response = await fetch(
    `https://api.elevenlabs.io/v1/convai/conversation/get-signed-url?agent_id=${encodeURIComponent(env.ELEVENLABS_AGENT_ID)}`,
    { headers: { "xi-api-key": env.ELEVENLABS_API_KEY } },
  );
  const data = (await response.json().catch(() => null)) as { signed_url?: string } | null;
  if (!response.ok || !data?.signed_url) {
    console.error("voice: could not start a call:", response.status);
    return Response.json({ error: "voice_unavailable" }, { status: 503 });
  }
  await recordUsage("voice", "call", ctx.locale);
  return Response.json({ signedUrl: data.signed_url });
}
