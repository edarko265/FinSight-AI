"use client";

import { ConversationProvider, useConversation } from "@elevenlabs/react";
import { useEffect, useRef, useState } from "react";

import { usePreferences } from "@/components/providers/PreferencesProvider";
import { PhoneIcon } from "@/components/ui/icons";
import { api } from "@/lib/api-client";
import type { AssistantMessage } from "@/lib/contracts/chat";

interface VoiceCallProps {
  /** Called for each question the customer asks aloud and the coach's answer, so both appear in the chat. */
  onExchange: (question: string, reply: AssistantMessage) => void;
  onEnd: () => void;
}

/**
 * A realtime voice call with the coach. The voice agent only listens and
 * speaks: every question goes through `ask_finsight`, which runs here in the
 * browser and asks our own coach, so the spoken figures are the same
 * server-calculated ones as in the chat.
 */
function Call({ onExchange, onEnd }: VoiceCallProps): React.JSX.Element {
  const { t, locale } = usePreferences();
  const [failed, setFailed] = useState(false);
  const started = useRef(false);
  const exchange = useRef(onExchange);
  const localeRef = useRef(locale);

  useEffect(() => {
    exchange.current = onExchange;
    localeRef.current = locale;
  }, [onExchange, locale]);

  const conversation = useConversation({
    clientTools: {
      ask_finsight: async (parameters: Record<string, unknown>): Promise<string> => {
        const question = typeof parameters.question === "string" ? parameters.question : "";
        if (!question) return "No question was given.";
        try {
          const reply = await api<AssistantMessage>("/api/chat", {
            method: "POST",
            json: { message: question, locale: localeRef.current },
          });
          exchange.current(question, reply);
          return reply.text;
        } catch {
          return "The customer's data could not be reached. Ask them to try again.";
        }
      },
    },
    onError: () => setFailed(true),
  });
  const { startSession, endSession, status, isSpeaking } = conversation;

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    api<{ signedUrl: string }>("/api/voice/agent")
      .then(({ signedUrl }) =>
        startSession({ signedUrl, overrides: { agent: { language: localeRef.current } } }),
      )
      .catch(() => setFailed(true));
    return () => endSession();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- start once when the call opens, end when it closes
  }, []);

  const label = failed
    ? t("voice.call.failed")
    : status !== "connected"
      ? t("voice.call.connecting")
      : isSpeaking
        ? t("voice.call.speaking")
        : t("voice.call.listening");

  return (
    <div
      role="status"
      className="mb-3 flex items-center justify-between gap-3 rounded-2xl bg-brand px-4 py-3 text-on-brand"
    >
      <span className="flex items-center gap-3">
        <span
          className={`relative flex size-9 items-center justify-center rounded-full bg-white/15 ${
            status === "connected" && !isSpeaking ? "animate-pulse" : ""
          }`}
        >
          <PhoneIcon className="size-5" />
        </span>
        <span className="flex flex-col leading-tight">
          <span className="text-sm font-semibold">{t("voice.call.live")}</span>
          <span className="text-xs opacity-80">{label}</span>
        </span>
      </span>
      <button
        type="button"
        onClick={onEnd}
        className="shrink-0 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-on-primary"
      >
        {t("voice.call.end")}
      </button>
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
