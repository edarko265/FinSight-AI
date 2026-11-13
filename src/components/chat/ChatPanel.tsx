"use client";

import { useEffect, useRef, useState } from "react";

import { ChartView } from "@/components/charts/ChartView";
import { EvidenceSheet } from "@/components/evidence/EvidenceSheet";
import { useOverview } from "@/components/providers/OverviewProvider";
import { usePreferences } from "@/components/providers/PreferencesProvider";
import { MicIcon, SendIcon, SpeakerIcon, StopIcon } from "@/components/ui/icons";
import { useVoice } from "@/components/voice/useVoice";
import { api } from "@/lib/api-client";
import type { ChartCard } from "@/lib/contracts/chart";
import type { AssistantMessage, ChatMessage, EvidenceRef } from "@/lib/contracts/chat";
import type { MessageKey } from "@/lib/i18n/translate";

interface ChatPanelProps {
  /** Overrides the default greeting, e.g. inside the new-widget sheet. */
  intro?: string;
  placeholder?: string;
  /** A question to ask as soon as the panel opens (used by insights). */
  initialQuestion?: string;
  /** Rendered under each chart the assistant returns, e.g. an "Add to dashboard" button. */
  cardAction?: (card: ChartCard) => React.ReactNode;
}

const SUGGESTIONS: MessageKey[] = [
  "chat.suggest.where",
  "chat.suggest.taxi",
  "chat.suggest.safe",
  "chat.suggest.whatif",
  "chat.suggest.spender",
  "chat.suggest.peers",
  "chat.suggest.bills",
];

export function ChatPanel({
  intro,
  placeholder,
  initialQuestion,
  cardAction,
}: ChatPanelProps): React.JSX.Element {
  const { t, locale, voiceReplies } = usePreferences();
  const { me } = useOverview();
  const voice = useVoice(locale);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [pending, setPending] = useState(false);
  const [evidence, setEvidence] = useState<EvidenceRef | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const asked = useRef(false);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [messages, pending]);

  async function send(text: string): Promise<void> {
    const question = text.trim();
    if (!question || pending) return;
    const history = messages
      .slice(-8)
      .map((message) => ({ role: message.role, text: message.text }));
    setMessages((current) => [
      ...current,
      { id: `user-${Date.now()}`, role: "user", text: question },
    ]);
    setDraft("");
    setPending(true);
    try {
      const reply = await api<AssistantMessage>("/api/chat", {
        method: "POST",
        json: { message: question, locale, history },
      });
      setMessages((current) => [...current, reply]);
      if (voiceReplies && me?.voiceEnabled) void voice.speak(reply.id, reply.text);
    } catch {
      setMessages((current) => [
        ...current,
        { id: `assistant-error-${Date.now()}`, role: "assistant", text: t("chat.error") },
      ]);
    } finally {
      setPending(false);
    }
  }

  useEffect(() => {
    if (!initialQuestion || asked.current) return;
    asked.current = true;
    void send(initialQuestion);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- ask once when the panel opens
  }, [initialQuestion]);

  async function toggleRecording(): Promise<void> {
    if (!voice.recording) {
      await voice.startRecording();
      return;
    }
    const heard = await voice.stopRecording();
    if (heard) void send(heard);
  }

  const lastAssistant = [...messages].reverse().find((message) => message.role === "assistant");
  const followUps =
    !pending && lastAssistant?.role === "assistant" ? (lastAssistant.followUps ?? []) : [];
  const chips = messages.length === 0 ? SUGGESTIONS.map((key) => t(key)) : followUps;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex-1 overflow-y-auto px-4 py-4">
        <ol className="flex flex-col gap-3" aria-live="polite">
          <li className="max-w-[85%] self-start rounded-2xl rounded-bl-md bg-surface px-4 py-3 text-sm shadow-sm">
            {intro ?? t("chat.intro")}
          </li>

          {messages.map((message) =>
            message.role === "user" ? (
              <li
                key={message.id}
                className="max-w-[85%] self-end rounded-2xl rounded-br-md bg-brand px-4 py-3 text-sm text-on-brand"
              >
                {message.text}
              </li>
            ) : (
              <li key={message.id} className="flex w-full flex-col gap-2 self-start">
                <div className="max-w-[85%] rounded-2xl rounded-bl-md bg-surface px-4 py-3 text-sm shadow-sm">
                  <p>{message.text}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
                    {message.mode ? (
                      <span>{t(message.mode === "ai" ? "chat.modeAi" : "chat.modeBasic")}</span>
                    ) : null}
                    {me?.voiceEnabled ? (
                      <button
                        type="button"
                        onClick={() =>
                          voice.speakingId === message.id
                            ? voice.stopSpeaking()
                            : void voice.speak(message.id, message.text)
                        }
                        className="flex items-center gap-1 font-medium text-accent"
                      >
                        {voice.speakingId === message.id ? (
                          <StopIcon className="size-4" />
                        ) : (
                          <SpeakerIcon className="size-4" />
                        )}
                        {t(voice.speakingId === message.id ? "chat.stop" : "chat.listen")}
                      </button>
                    ) : null}
                  </div>
                </div>

                {message.card ? (
                  <div className="rounded-2xl border border-border bg-surface p-4">
                    <h3 className="text-sm font-semibold">{message.card.title}</h3>
                    <div className="mt-3">
                      <ChartView card={message.card} />
                    </div>
                    <p className="mt-3 text-xs text-muted">{message.card.basis}</p>
                    {message.lesson ? (
                      <p className="mt-3 rounded-xl bg-accent-soft px-3 py-2 text-xs">
                        {message.lesson}
                      </p>
                    ) : null}
                    {message.evidence && message.evidence.transactionCount > 0 ? (
                      <button
                        type="button"
                        onClick={() => setEvidence(message.evidence ?? null)}
                        className="mt-3 text-sm font-medium text-accent underline-offset-2 hover:underline"
                      >
                        {t("chat.seeTransactions")} ({message.evidence.transactionCount})
                      </button>
                    ) : null}
                    {cardAction ? <div className="mt-3">{cardAction(message.card)}</div> : null}
                  </div>
                ) : null}
              </li>
            ),
          )}

          {pending ? (
            <li
              className="max-w-[85%] self-start rounded-2xl rounded-bl-md bg-surface px-4 py-3 text-sm text-muted shadow-sm"
              role="status"
            >
              {t("chat.thinking")}
            </li>
          ) : null}
        </ol>
        <div ref={endRef} />
      </div>

      <div className="border-t border-border bg-background px-4 pt-3 pb-3">
        {chips.length > 0 ? (
          <ul className="-mx-4 mb-3 flex gap-2 overflow-x-auto px-4 pb-1">
            {chips.map((suggestion) => (
              <li key={suggestion} className="shrink-0">
                <button
                  type="button"
                  onClick={() => void send(suggestion)}
                  className="rounded-full border border-border bg-surface px-3.5 py-2 text-sm font-medium"
                >
                  {suggestion}
                </button>
              </li>
            ))}
          </ul>
        ) : null}

        {voice.error === "mic" ? (
          <p className="mb-2 text-xs text-warning">{t("chat.micDenied")}</p>
        ) : null}

        <form
          className="flex items-center gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            void send(draft);
          }}
        >
          <label htmlFor="chat-input" className="sr-only">
            {placeholder ?? t("chat.placeholder")}
          </label>
          <input
            id="chat-input"
            value={voice.recording ? "" : draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder={
              voice.recording ? t("chat.listening") : (placeholder ?? t("chat.placeholder"))
            }
            autoComplete="off"
            disabled={voice.recording}
            className="min-w-0 flex-1 rounded-full border border-border bg-surface px-4 py-3 text-base outline-none focus-visible:ring-2 focus-visible:ring-accent"
          />
          {me?.voiceEnabled ? (
            <button
              type="button"
              onClick={() => void toggleRecording()}
              aria-label={t(voice.recording ? "chat.stop" : "chat.speak")}
              aria-pressed={voice.recording}
              className={`rounded-full p-3 ${
                voice.recording
                  ? "bg-accent text-surface"
                  : "border border-border bg-surface text-accent"
              }`}
            >
              {voice.recording ? <StopIcon className="size-5" /> : <MicIcon className="size-5" />}
            </button>
          ) : null}
          <button
            type="submit"
            disabled={pending || draft.trim() === ""}
            aria-label={t("chat.send")}
            className="rounded-full bg-primary p-3 text-on-primary disabled:opacity-40"
          >
            <SendIcon className="size-5" />
          </button>
        </form>
      </div>

      <EvidenceSheet evidence={evidence} onClose={() => setEvidence(null)} />
    </div>
  );
}
