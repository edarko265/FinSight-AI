"use client";

import { ConversationProvider, useConversation } from "@elevenlabs/react";
import { useEffect, useRef, useState } from "react";

import { ChartView } from "@/components/charts/ChartView";
import { usePreferences } from "@/components/providers/PreferencesProvider";
import { CloseIcon, MicIcon, PhoneIcon } from "@/components/ui/icons";
import { useCloseOnNavigation, useEscapeClose } from "@/components/ui/TabSheet";
import { createSessionGuard } from "@/components/voice/session-guard";
import { api } from "@/lib/api-client";
import type { AssistantMessage } from "@/lib/contracts/chat";

/** A pinned copy of libsamplerate-js 2.1.2 (MIT); see public/voice/README.md. */
const RESAMPLER_PATH = "/voice/libsamplerate.worklet.js";

interface VoiceCallProps {
  /** Called for each question the customer asks aloud and the coach's answer, so both appear in the chat. */
  onExchange: (question: string, reply: AssistantMessage) => void;
  onEnd: () => void;
}

interface Caption {
  id: number;
  role: "user" | "agent";
  text: string;
}

/**
 * A realtime voice call with the coach, shown full-screen: an orb that moves
 * with the voices, live captions, and the chart for the latest answer.
 *
 * The voice agent only listens and speaks. Every question goes through
 * `ask_finsight`, which runs here in the browser and asks our own coach, so
 * the spoken figures are the same server-calculated ones as in the chat.
 */
function Call({ onExchange, onEnd }: VoiceCallProps): React.JSX.Element {
  const { t, locale } = usePreferences();
  const [failed, setFailed] = useState(false);
  const [thinking, setThinking] = useState(false);
  const [captions, setCaptions] = useState<Caption[]>([]);
  const [latest, setLatest] = useState<AssistantMessage | null>(null);
  const started = useRef(false);
  const exchange = useRef(onExchange);
  const localeRef = useRef(locale);
  const orb = useRef<HTMLDivElement>(null);
  const captionId = useRef(0);

  useEffect(() => {
    exchange.current = onExchange;
    localeRef.current = locale;
  }, [onExchange, locale]);

  const conversation = useConversation({
    clientTools: {
      ask_finsight: async (parameters: Record<string, unknown>): Promise<string> => {
        const question = typeof parameters.question === "string" ? parameters.question : "";
        if (!question) return "No question was given.";
        setThinking(true);
        try {
          const reply = await api<AssistantMessage>("/api/chat", {
            method: "POST",
            json: { message: question, locale: localeRef.current },
          });
          exchange.current(question, reply);
          setLatest(reply);
          return reply.text;
        } catch {
          return "The customer's data could not be reached. Ask them to try again.";
        } finally {
          setThinking(false);
        }
      },
    },
    onMessage: (payload: { message?: string; role?: string; source?: string }) => {
      const text = payload.message?.trim();
      if (!text) return;
      captionId.current += 1;
      const role = (payload.role ?? payload.source) === "user" ? "user" : "agent";
      setCaptions((current) => [...current.slice(-5), { id: captionId.current, role, text }]);
    },
    onError: (message: unknown) => {
      // The reason only, for whoever is looking at the console; nothing about the customer.
      console.error("voice call:", typeof message === "string" ? message : "failed");
      setFailed(true);
    },
  });
  const {
    startSession,
    endSession,
    status,
    isSpeaking,
    isMuted,
    setMuted,
    getInputVolume,
    getOutputVolume,
  } = conversation;

  // The session is ended once, whether by navigation, Escape, the button or unmounting.
  const guard = useRef(createSessionGuard());
  const hangUp = (): void => {
    if (guard.current.end()) endSession();
  };
  const endButton = useRef<HTMLButtonElement>(null);
  useEffect(() => endButton.current?.focus(), []);
  // Tapping a tab hangs up (the dock keeps the chat mounted across pages); so does Escape.
  useCloseOnNavigation(true, () => {
    hangUp();
    onEnd();
  });
  const endCall = (): void => {
    hangUp();
    onEnd();
  };
  useEscapeClose(true, endCall);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    api<{ signedUrl: string }>("/api/voice/agent")
      .then(({ signedUrl }) =>
        startSession({
          signedUrl,
          overrides: { agent: { language: localeRef.current } },
          // Safari cannot ask the microphone for a sample rate, so the voice library converts
          // the sound itself with this helper. It is served from this site: the library's
          // default is a public CDN, which the content security policy rightly refuses.
          libsampleratePath: RESAMPLER_PATH,
        }),
      )
      .then(() => guard.current.started())
      .catch(() => setFailed(true));
    return () => hangUp();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- start once when the call opens, end when it closes
  }, []);

  // The orb swells with whoever is speaking. Written straight to the element so it stays smooth.
  const connected = status === "connected";
  useEffect(() => {
    if (!connected || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let frame = 0;
    let level = 0;
    const tick = (): void => {
      const volume = Math.max(getInputVolume(), getOutputVolume());
      level += (Math.min(1, volume * 1.6) - level) * 0.25;
      orb.current?.style.setProperty("--level", level.toFixed(3));
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [connected, getInputVolume, getOutputVolume]);

  const label = failed
    ? t("voice.call.failed")
    : !connected
      ? t("voice.call.connecting")
      : thinking
        ? t("voice.call.thinking")
        : isSpeaking
          ? t("voice.call.speaking")
          : t("voice.call.listening");

  return (
    <div
      role="dialog"
      aria-label={t("voice.call.title")}
      className="fixed inset-x-0 top-0 bottom-[calc(env(safe-area-inset-bottom)+var(--bottom-nav-h))] z-40 flex flex-col bg-brand px-[max(0px,calc((100vw-30rem)/2))] text-on-brand fs-rise"
    >
      <header className="flex items-center justify-between px-5 pt-[calc(env(safe-area-inset-top)+1rem)]">
        <span className="flex items-center gap-2 text-sm font-semibold">
          <PhoneIcon className="size-4" />
          {t("voice.call.title")}
        </span>
        <button
          ref={endButton}
          type="button"
          onClick={endCall}
          aria-label={t("voice.call.end")}
          className="-m-2 rounded-full p-2"
        >
          <CloseIcon />
        </button>
      </header>

      <div className="flex flex-1 flex-col items-center justify-center gap-6 px-6">
        <div
          ref={orb}
          aria-hidden="true"
          className="relative flex size-44 items-center justify-center"
          style={{ ["--level" as string]: "0" }}
        >
          {connected && !isSpeaking && !thinking ? (
            <>
              <span className="absolute inset-4 rounded-full border border-primary/50 fs-ring" />
              <span className="absolute inset-4 rounded-full border border-primary/40 fs-ring [animation-delay:0.8s]" />
            </>
          ) : null}
          <span
            className={`absolute inset-0 rounded-full bg-[conic-gradient(from_0deg,#91fa9b,#0a5a36,#4cc486,#91fa9b)] opacity-70 blur-xl ${
              thinking || !connected ? "fs-spin" : ""
            }`}
            style={{ transform: "scale(calc(0.72 + var(--level) * 0.5))" }}
          />
          <span
            className="relative flex size-28 items-center justify-center rounded-full bg-primary text-on-primary shadow-2xl fs-breathe"
            style={{ transform: "scale(calc(1 + var(--level) * 0.35))" }}
          >
            {isSpeaking ? (
              <span className="flex h-10 items-center gap-1.5">
                {[0, 1, 2, 3, 4].map((bar) => (
                  <span
                    key={bar}
                    className="h-full w-1.5 rounded-full bg-on-primary fs-wave"
                    style={{ animationDelay: `${bar * 0.12}s` }}
                  />
                ))}
              </span>
            ) : (
              <MicIcon className="size-10" />
            )}
          </span>
        </div>

        <p role="status" className="text-center text-lg font-semibold">
          {label}
        </p>

        <ol
          className="flex max-h-40 w-full flex-col gap-2 overflow-y-auto text-sm"
          aria-live="polite"
        >
          {captions.length === 0 && connected ? (
            <li className="text-center opacity-70">{t("voice.call.hint")}</li>
          ) : null}
          {captions.map((caption) => (
            <li
              key={caption.id}
              className={`fs-rise ${caption.role === "user" ? "text-right opacity-80" : ""}`}
            >
              <span className="text-xs font-semibold opacity-80">
                {t(caption.role === "user" ? "voice.call.you" : "voice.call.coach")}
              </span>
              <span className="block">{caption.text}</span>
            </li>
          ))}
        </ol>

        {latest?.card ? (
          <div className="w-full rounded-2xl bg-surface p-4 text-foreground fs-pop">
            <h3 className="text-sm font-semibold">{latest.card.title}</h3>
            <div className="mt-2 max-h-44 overflow-y-auto">
              <ChartView card={latest.card} />
            </div>
          </div>
        ) : null}
      </div>

      <div className="flex items-center justify-center gap-4 px-6 pb-6">
        <button
          type="button"
          onClick={() => setMuted(!isMuted)}
          aria-pressed={isMuted}
          aria-label={t(isMuted ? "voice.call.unmute" : "voice.call.mute")}
          className={`flex size-14 items-center justify-center rounded-full ${
            isMuted ? "bg-surface text-warning" : "bg-white/15"
          }`}
        >
          <MicIcon className="size-6" />
        </button>
        <button
          type="button"
          onClick={endCall}
          className="flex h-14 flex-1 items-center justify-center gap-2 rounded-full bg-primary text-base font-semibold text-on-primary"
        >
          <PhoneIcon className="size-5" />
          {t("voice.call.end")}
        </button>
      </div>
    </div>
  );
}

export function VoiceCall(props: VoiceCallProps): React.JSX.Element {
  return (
    <ConversationProvider>
      <Call {...props} />
    </ConversationProvider>
  );
}
