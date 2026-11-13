import "server-only";

import { getEnv } from "@/lib/env";
import { LOCALE_INFO, type Locale } from "@/lib/i18n/config";

/**
 * ElevenLabs speech, called from the server only so the API key never reaches
 * the browser. Text sent for speech is the coach's finished answer; audio sent
 * for transcription is the user's spoken question.
 */
const API = "https://api.elevenlabs.io/v1";
const TTS_MODEL = "eleven_flash_v2_5";
const STT_MODEL = "scribe_v1";

let cachedVoiceId: string | undefined;

function apiKey(): string {
  const key = getEnv().ELEVENLABS_API_KEY;
  if (!key) throw new Error("Voice is not configured");
  return key;
}

async function voiceId(): Promise<string> {
  const configured = process.env.ELEVENLABS_VOICE_ID?.trim();
  if (configured) return configured;
  if (cachedVoiceId) return cachedVoiceId;
  const response = await fetch(`${API}/voices`, { headers: { "xi-api-key": apiKey() } });
  if (!response.ok) throw new Error(`Voice list failed (${response.status})`);
  const data = (await response.json()) as { voices?: { voice_id: string }[] };
  const first = data.voices?.[0]?.voice_id;
  if (!first) throw new Error("No voice available on this ElevenLabs account");
  cachedVoiceId = first;
  return first;
}

/** Speaks text in the given language. Returns the provider's MP3 stream. */
export async function synthesizeSpeech(text: string, locale: Locale): Promise<Response> {
  const response = await fetch(
    `${API}/text-to-speech/${await voiceId()}/stream?output_format=mp3_44100_128`,
    {
      method: "POST",
      headers: { "xi-api-key": apiKey(), "Content-Type": "application/json" },
      body: JSON.stringify({
        text,
        model_id: TTS_MODEL,
        language_code: LOCALE_INFO[locale].speech,
      }),
    },
  );
  if (!response.ok || !response.body) throw new Error(`Speech failed (${response.status})`);
  return response;
}

/** Transcribes a short recording. */
export async function transcribeSpeech(audio: Blob, locale: Locale): Promise<string> {
  const form = new FormData();
  form.append("file", audio, "question.webm");
  form.append("model_id", STT_MODEL);
  form.append("language_code", LOCALE_INFO[locale].speech);
  const response = await fetch(`${API}/speech-to-text`, {
    method: "POST",
    headers: { "xi-api-key": apiKey() },
    body: form,
  });
  if (!response.ok) throw new Error(`Transcription failed (${response.status})`);
  const data = (await response.json()) as { text?: string };
  return (data.text ?? "").trim();
}
