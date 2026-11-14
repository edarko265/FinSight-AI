"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { ChartView } from "@/components/charts/ChartView";
import { ConsentSheet } from "@/components/chat/ConsentSheet";
import { EvidenceSheet } from "@/components/evidence/EvidenceSheet";
import { useOverview } from "@/components/providers/OverviewProvider";
import { usePreferences } from "@/components/providers/PreferencesProvider";
import { MicIcon, PhoneIcon, SendIcon, SpeakerIcon, StopIcon } from "@/components/ui/icons";
import { useVoice } from "@/components/voice/useVoice";
import { VoiceCall } from "@/components/voice/VoiceCall";
import { api } from "@/lib/api-client";
import type { ChartCard, WidgetQuery } from "@/lib/contracts/chart";
import type { AssistantMessage, ChatMessage, EvidenceRef } from "@/lib/contracts/chat";
import type { MessageKey } from "@/lib/i18n/translate";

interface ChatPanelProps {
  /** Overrides the default greeting, e.g. inside the new-widget sheet. */
  intro?: string;
  placeholder?: string;
  /** A question to ask as soon as the panel opens (used by insights). */
  initialQuestion?: string;
  /** Begin by listening for a spoken question, or by starting a voice call. */
  start?: "listen" | "call";
  /** Rendered under each chart the assistant returns, e.g. an "Add to dashboard" button. */
  cardAction?: (card: ChartCard, query: WidgetQuery | undefined) => React.ReactNode;
}

/** How many starter questions are shown before "More questions" is tapped. */
const STARTERS = 5;

const SUGGESTIONS: MessageKey[] = [
  "chat.suggest.where",
  "chat.suggest.recommend",
  "chat.suggest.goal",
  "chat.suggest.afford",
  "chat.suggest.flow",
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
  start,
  cardAction,
}: ChatPanelProps): React.JSX.Element {
  const { t, locale, voiceReplies } = usePreferences();
  const { me, refresh } = useOverview();
  const [declined, setDeclined] = useState(false);
  const [calling, setCalling] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const voice = useVoice(locale);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [pending, setPending] = useState(false);
  const [evidence, setEvidence] = useState<EvidenceRef | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const asked = useRef(false);

  useEffect(() => {
    // Only follow the conversation; an empty chat stays at the top so the greeting is visible.
    if (messages.length > 0 || pending) endRef.current?.scrollIntoView({ block: "end" });
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

  // Once it is known what this customer may use, honour a shortcut from the dashboard, once.
  const started = useRef(false);
  useEffect(() => {
    if (!start || !me || started.current) return;
    started.current = true;
    if (start === "call" && me.voiceAgentEnabled && me.aiConsent) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time start asked for by the link that opened the page
      setCalling(true);
    } else if (start === "listen" && me.voiceEnabled) {
      void voice.startRecording();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- runs once when the account state arrives
  }, [start, me]);

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

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex-1 overflow-y-auto px-4 py-4">
        <ol className="flex flex-col gap-3" aria-live="polite">
          <li className="max-w-[85%] self-start rounded-2xl rounded-bl-md bg-surface px-4 py-3 text-sm shadow-sm">
            {intro ?? t("chat.intro")}
          </li>

          {messages.length === 0 ? (
            <li className="fs-rise">
              {/* Starter questions laid out in a grid, so nothing has to be scrolled sideways. */}
              <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {(showAll ? SUGGESTIONS : SUGGESTIONS.slice(0, STARTERS)).map((key) => (
                  <li key={key}>
                    <button
                      type="button"
                      onClick={() => void send(t(key))}
                      className="h-full w-full rounded-2xl border border-border bg-surface px-4 py-3 text-left text-sm font-medium"
                    >
                      {t(key)}
                    </button>
                  </li>
                ))}
              </ul>
              {showAll ? null : (
                <button
                  type="button"
                  onClick={() => setShowAll(true)}
                  className="mt-2 w-full rounded-full px-4 py-2 text-sm font-semibold text-accent"
                >
                  {t("chat.moreQuestions")}
                </button>
              )}
            </li>
          ) : null}

          {messages.map((message) =>
            message.role === "user" ? (
              <li
                key={message.id}
                className="max-w-[85%] self-end rounded-2xl rounded-br-md bg-brand px-4 py-3 text-sm text-on-brand fs-rise"
              >
                {message.text}
              </li>
            ) : (
              <li key={message.id} className="flex w-full flex-col gap-2 self-start fs-rise">
                <div className="max-w-[85%] rounded-2xl rounded-bl-md bg-surface px-4 py-3 text-sm shadow-sm">
                  <p>{message.text}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
                    {message.mode ? (
                      <span>
                        {t(
                          message.mode === "ai"
                            ? "chat.modeAi"
                            : message.mode === "team"
                              ? "chat.modeTeam"
                              : "chat.modeBasic",
                        )}
                      </span>
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
                          <span className="flex h-4 items-center gap-0.5" aria-hidden="true">
                            {[0, 1, 2].map((bar) => (
                              <span
                                key={bar}
                                className="h-full w-0.5 rounded-full bg-accent fs-wave"
                                style={{ animationDelay: `${bar * 0.15}s` }}
                              />
                            ))}
                          </span>
                        ) : (
                          <SpeakerIcon className="size-4" />
                        )}
                        {t(voice.speakingId === message.id ? "chat.stop" : "chat.listen")}
                      </button>
                    ) : null}
                  </div>
                </div>

                {message.card ? (
                  <div className="rounded-2xl border border-border bg-surface p-4 fs-pop">
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
                    {cardAction ? (
                      <div className="mt-3">{cardAction(message.card, message.query)}</div>
                    ) : null}
                  </div>
                ) : null}
              </li>
            ),
          )}

          {followUps.length > 0 ? (
            <li>
              <ul className="flex flex-wrap gap-2">
                {followUps.map((suggestion) => (
                  <li key={suggestion}>
                    <button
                      type="button"
                      onClick={() => void send(suggestion)}
                      className="rounded-full border border-border bg-surface px-3.5 py-2 text-left text-sm font-medium"
                    >
                      {suggestion}
                    </button>
                  </li>
                ))}
              </ul>
            </li>
          ) : null}

          {pending ? (
            <li
              className="max-w-[85%] self-start rounded-2xl rounded-bl-md bg-surface px-4 py-3 text-sm text-muted shadow-sm"
              role="status"
            >
              <span className="sr-only">{t("chat.thinking")}</span>
              <span className="flex items-center gap-1.5 py-1" aria-hidden="true">
                {[0, 1, 2].map((dot) => (
                  <span
                    key={dot}
                    className="size-2 rounded-full bg-accent fs-dot"
                    style={{ animationDelay: `${dot * 0.18}s` }}
                  />
                ))}
              </span>
            </li>
          ) : null}
        </ol>
        <div ref={endRef} />
      </div>

      <div className="border-t border-border bg-background px-4 pt-3 pb-3">
        {calling ? (
          <VoiceCall
            onEnd={() => setCalling(false)}
            onExchange={(question, reply) =>
              setMessages((current) => [
                ...current,
                { id: `user-voice-${reply.id}`, role: "user", text: question },
                reply,
              ])
            }
          />
        ) : null}

        <div className="mb-2 flex items-center justify-center gap-5 text-xs font-semibold text-accent">
          {me?.voiceAgentEnabled && me.aiConsent && !calling ? (
            <button
              type="button"
              onClick={() => setCalling(true)}
              className="flex items-center gap-1.5"
            >
              <PhoneIcon className="size-4" />
              {t("voice.call.start")}
            </button>
          ) : null}
          {me?.advisorEnabled !== false ? <Link href="/advisor">{t("advisor.cta")} →</Link> : null}
        </div>

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
              className={`relative rounded-full p-3 ${
                voice.recording
                  ? "bg-accent text-surface"
                  : "border border-border bg-surface text-accent"
              }`}
            >
              {voice.recording ? (
                <>
                  <span
                    className="absolute inset-0 rounded-full bg-accent fs-ring"
                    aria-hidden="true"
                  />
                  <StopIcon className="relative size-5" />
                </>
              ) : (
                <MicIcon className="size-5" />
              )}
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
      <ConsentSheet
        open={Boolean(me?.aiEnabled && !me.aiConsent && !me.aiDecided && !declined)}
        onChoose={(accepted) => {
          setDeclined(!accepted);
          if (accepted) {
            void api("/api/consent", { method: "POST", json: { accepted: true } }).then(refresh);
          } else {
            // Remember the "no", so the question is not asked again on every visit.
            void api("/api/consent", { method: "POST", json: { accepted: false } }).then(refresh);
          }
        }}
      />
    </div>
  );
}
