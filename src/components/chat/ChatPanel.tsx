"use client";

import { useEffect, useRef, useState } from "react";
import { ChartView } from "@/components/charts/ChartView";
import type { ChartCard } from "@/lib/contracts/chart";
import type { ChatMessage } from "@/lib/contracts/chat";
import { askCoach } from "@/lib/demo/mock-ai";

interface ChatPanelProps {
  intro: string;
  suggestions: readonly string[];
  placeholder: string;
  /** Rendered under each chart the assistant returns, e.g. an "Add to dashboard" button. */
  cardAction?: (card: ChartCard) => React.ReactNode;
}

export function ChatPanel({
  intro,
  suggestions,
  placeholder,
  cardAction,
}: ChatPanelProps): React.JSX.Element {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [pending, setPending] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [messages, pending]);

  async function send(text: string): Promise<void> {
    const question = text.trim();
    if (!question || pending) return;
    setMessages((current) => [...current, { id: `user-${Date.now()}`, role: "user", text: question }]);
    setDraft("");
    setPending(true);
    try {
      const reply = await askCoach(question);
      setMessages((current) => [...current, reply]);
    } catch {
      setMessages((current) => [
        ...current,
        {
          id: `assistant-error-${Date.now()}`,
          role: "assistant",
          text: "Something went wrong on my side. Please try again.",
        },
      ]);
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex-1 overflow-y-auto px-4 py-4">
        <ol className="flex flex-col gap-3" aria-live="polite">
          <li className="max-w-[85%] self-start rounded-2xl rounded-bl-md bg-surface px-4 py-3 text-sm shadow-sm">
            {intro}
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
                <p className="max-w-[85%] rounded-2xl rounded-bl-md bg-surface px-4 py-3 text-sm shadow-sm">
                  {message.text}
                </p>
                {message.card ? (
                  <div className="rounded-2xl border border-border bg-surface p-4">
                    <h3 className="text-sm font-semibold">{message.card.title}</h3>
                    <p className="mt-1 mb-3 text-sm text-muted">{message.card.summary}</p>
                    <ChartView card={message.card} />
                    <p className="mt-3 text-xs text-muted">{message.card.basis}</p>
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
              Thinking…
            </li>
          ) : null}
        </ol>
        <div ref={endRef} />
      </div>

      <div className="border-t border-border bg-background px-4 pt-3 pb-3">
        {messages.length === 0 ? (
          <ul className="-mx-4 mb-3 flex gap-2 overflow-x-auto px-4 pb-1">
            {suggestions.map((suggestion) => (
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

        <form
          className="flex items-center gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            void send(draft);
          }}
        >
          <label htmlFor="chat-input" className="sr-only">
            Message
          </label>
          <input
            id="chat-input"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder={placeholder}
            autoComplete="off"
            className="min-w-0 flex-1 rounded-full border border-border bg-surface px-4 py-3 text-base outline-none focus-visible:ring-2 focus-visible:ring-accent"
          />
          <button
            type="submit"
            disabled={pending || draft.trim() === ""}
            className="rounded-full bg-primary px-5 py-3 text-sm font-semibold text-on-primary disabled:opacity-40"
          >
            Send
          </button>
        </form>
      </div>
    </div>
  );
}
