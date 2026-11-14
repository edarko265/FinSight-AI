import { getSettings } from "@/lib/admin/settings";
import { hasAiConsent, readConsent } from "@/lib/coach/consent";
import { getSessionContext, unauthorized } from "@/lib/coach/context";
import { getCoachModel } from "@/lib/coach/llm";
import { getEnv } from "@/lib/env";

export async function GET(): Promise<Response> {
  const ctx = await getSessionContext();
  if (!ctx) return unauthorized();
  const env = getEnv();
  const { features } = await getSettings();
  return Response.json({
    customerId: ctx.record.profile.customerId,
    asOf: ctx.asOf,
    aiEnabled: features.ai && getCoachModel() !== null,
    aiConsent: hasAiConsent(await readConsent(ctx.customerRef)),
    voiceEnabled: features.voice && Boolean(env.ELEVENLABS_API_KEY),
    voiceAgentEnabled: features.voice && Boolean(env.ELEVENLABS_API_KEY && env.ELEVENLABS_AGENT_ID),
    advisorEnabled: features.advisor,
    rewardsEnabled: features.rewards,
  });
}
