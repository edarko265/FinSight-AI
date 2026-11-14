/**
 * Whether a voice call can be offered: the voice agent is on, and the AI coach is either
 * already agreed to or can still be agreed to. Where it has not been agreed to yet, starting
 * a call asks for that first, so the option never silently goes missing.
 */
export function callPossible(
  me: { voiceAgentEnabled: boolean; aiConsent: boolean; aiEnabled: boolean } | null,
): boolean {
  return Boolean(me?.voiceAgentEnabled && (me.aiConsent || me.aiEnabled));
}
