"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import type { Locale } from "@/lib/i18n/config";

/**
 * Voice for the coach: record a spoken question and play a spoken answer.
 * Audio goes to our own server, which talks to the speech provider.
 */
export function useVoice(locale: Locale) {
  const [recording, setRecording] = useState(false);
  /** True while the recorded audio is being sent to be turned into text. */
  const [transcribing, setTranscribing] = useState(false);
  const [speakingId, setSpeakingId] = useState<string | null>(null);
  const [error, setError] = useState<"mic" | "unavailable" | null>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const audio = useRef<HTMLAudioElement | null>(null);

  const stopSpeaking = useCallback(() => {
    audio.current?.pause();
    audio.current = null;
    setSpeakingId(null);
  }, []);

  useEffect(() => stopSpeaking, [stopSpeaking]);

  const speak = useCallback(
    async (id: string, text: string) => {
      stopSpeaking();
      setSpeakingId(id);
      try {
        const response = await fetch("/api/voice/tts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text, locale }),
        });
        if (!response.ok) throw new Error("unavailable");
        const url = URL.createObjectURL(await response.blob());
        const player = new Audio(url);
        audio.current = player;
        player.onended = () => {
          URL.revokeObjectURL(url);
          setSpeakingId((current) => (current === id ? null : current));
        };
        await player.play();
      } catch {
        setSpeakingId(null);
        setError("unavailable");
      }
    },
    [locale, stopSpeaking],
  );

  const startRecording = useCallback(async () => {
    setError(null);
    stopSpeaking();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const next = new MediaRecorder(stream);
      chunks.current = [];
      next.ondataavailable = (event) => {
        if (event.data.size > 0) chunks.current.push(event.data);
      };
      next.start();
      recorder.current = next;
      setRecording(true);
    } catch {
      setError("mic");
    }
  }, [stopSpeaking]);

  /** Stops recording and returns the transcribed question, or null if nothing was heard. */
  const stopRecording = useCallback(async (): Promise<string | null> => {
    const active = recorder.current;
    if (!active) return null;
    const stopped = new Promise<void>((resolve) => {
      active.onstop = () => resolve();
    });
    active.stop();
    await stopped;
    active.stream.getTracks().forEach((track) => track.stop());
    recorder.current = null;
    setRecording(false);
    setError(null);
    setTranscribing(true);

    const form = new FormData();
    form.append("audio", new Blob(chunks.current, { type: active.mimeType || "audio/webm" }));
    form.append("locale", locale);
    try {
      const response = await fetch("/api/voice/stt", { method: "POST", body: form });
      if (!response.ok) throw new Error("unavailable");
      const data = (await response.json()) as { text?: string };
      return data.text?.trim() || null;
    } catch {
      setError("unavailable");
      return null;
    } finally {
      setTranscribing(false);
    }
  }, [locale]);

  return {
    recording,
    transcribing,
    speakingId,
    error,
    speak,
    stopSpeaking,
    startRecording,
    stopRecording,
  };
}
