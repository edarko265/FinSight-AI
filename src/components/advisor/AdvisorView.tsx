"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { usePreferences } from "@/components/providers/PreferencesProvider";
import { SendIcon } from "@/components/ui/icons";
import { api } from "@/lib/api-client";
import { formatMoney, formatSlot } from "@/lib/i18n/config";
import type { MessageKey } from "@/lib/i18n/translate";

interface Message {
  id: string;
  sender: "customer" | "advisor";
  text: string;
}

interface AdvisorRequest {
  id: string;
  topic: "general" | "investment";
  status: "open" | "active" | "closed";
  slot: string;
  feeCents: number;
  messages: Message[];
}

interface Payload {
  request: AdvisorRequest | null;
  slots: string[];
  nextFeeCents: number;
}

const POLL_MS = 4000;

/** Hand-over to a human adviser: request one and book a call, then continue the conversation with them. */
export function AdvisorView(): React.JSX.Element {
  const { t, locale } = usePreferences();
  const [data, setData] = useState<Payload | null>(null);
  const [topic, setTopic] = useState<"general" | "investment">("general");
  const [slot, setSlot] = useState("");
  const [note, setNote] = useState("");
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    const load = (): void => {
      api<Payload>("/api/advisor")
        .then((payload) => {
          if (!cancelled) setData(payload);
        })
        .catch(() => undefined);
    };
    load();
    const timer = window.setInterval(load, POLL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, []);

  const messageCount = data?.request?.messages.length ?? 0;
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [messageCount]);

  async function submit(event: React.FormEvent): Promise<void> {
    event.preventDefault();
    if (!data) return;
    setBusy(true);
    try {
      const { request } = await api<{ request: AdvisorRequest }>("/api/advisor", {
        method: "POST",
        json: { topic, slot: slot || data.slots[0], note },
      });
      setData({ ...data, request });
    } finally {
      setBusy(false);
    }
  }

  async function send(event: React.FormEvent): Promise<void> {
    event.preventDefault();
    const text = draft.trim();
    if (!text || !data) return;
    setDraft("");
    const { request } = await api<{ request: AdvisorRequest }>("/api/advisor/messages", {
      method: "POST",
      json: { text },
    });
    setData({ ...data, request });
  }

  const request = data?.request;

  if (request) {
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="border-b border-border bg-surface px-4 py-3">
          <p className="text-sm font-semibold">
            {t(`advisor.status.${request.status}` as MessageKey)}
          </p>
          <p className="text-xs text-muted">
            {t(`advisor.topic.${request.topic}` as MessageKey)} ·{" "}
            {t("advisor.booked", { slot: formatSlot(request.slot, locale) })}
          </p>
        </div>
        <div className="flex-1 overflow-y-auto px-4 py-4">
          <ol className="flex flex-col gap-3" aria-live="polite">
            <li className="self-center rounded-full bg-accent-soft px-3 py-1.5 text-center text-xs">
              {t("advisor.waiting")}
            </li>
            {request.messages.map((message) => (
              <li
                key={message.id}
                className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm ${
                  message.sender === "customer"
                    ? "self-end rounded-br-md bg-brand text-on-brand"
                    : "self-start rounded-bl-md bg-surface shadow-sm"
                }`}
              >
                <span className="mb-0.5 block text-[11px] font-semibold opacity-70">
                  {t(message.sender === "customer" ? "advisor.you" : "advisor.adviser")}
                </span>
                {message.text}
              </li>
            ))}
          </ol>
          <div ref={endRef} />
        </div>
        <div className="border-t border-border bg-background px-4 pt-3 pb-3">
          <form className="flex items-center gap-2" onSubmit={(event) => void send(event)}>
            <label htmlFor="advisor-input" className="sr-only">
              {t("advisor.placeholder")}
            </label>
            <input
              id="advisor-input"
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder={t("advisor.placeholder")}
              autoComplete="off"
              className="min-w-0 flex-1 rounded-full border border-border bg-surface px-4 py-3 text-base outline-none focus-visible:ring-2 focus-visible:ring-accent"
            />
            <button
              type="submit"
              disabled={draft.trim() === ""}
              aria-label={t("chat.send")}
              className="rounded-full bg-primary p-3 text-on-primary disabled:opacity-40"
            >
              <SendIcon className="size-5" />
            </button>
          </form>
          <Link href="/chat" className="mt-2 block text-center text-sm font-medium text-accent">
            {t("advisor.backToCoach")}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={(event) => void submit(event)} className="flex flex-col gap-5 px-4 py-4">
      <div>
        <h1 className="text-xl font-semibold">{t("advisor.title")}</h1>
        <p className="mt-1 text-sm text-muted">{t("advisor.intro")}</p>
      </div>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-sm font-semibold">{t("advisor.topic")}</legend>
        {(["general", "investment"] as const).map((option) => (
          <label
            key={option}
            className={`flex items-center gap-3 rounded-2xl border px-4 py-3 text-sm ${
              topic === option ? "border-accent bg-accent-soft" : "border-border bg-surface"
            }`}
          >
            <input
              type="radio"
              name="topic"
              checked={topic === option}
              onChange={() => setTopic(option)}
              className="size-4 accent-(--accent)"
            />
            {t(`advisor.topic.${option}` as MessageKey)}
          </label>
        ))}
      </fieldset>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="advisor-slot" className="text-sm font-semibold">
          {t("advisor.slot")}
        </label>
        <select
          id="advisor-slot"
          value={slot || data?.slots[0] || ""}
          onChange={(event) => setSlot(event.target.value)}
          className="rounded-xl border border-border bg-surface px-4 py-3 text-base"
        >
          {data?.slots.map((option) => (
            <option key={option} value={option}>
              {formatSlot(option, locale)}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="advisor-note" className="text-sm font-semibold">
          {t("advisor.note")}
        </label>
        <textarea
          id="advisor-note"
          value={note}
          onChange={(event) => setNote(event.target.value)}
          placeholder={t("advisor.notePlaceholder")}
          maxLength={1000}
          rows={3}
          className="rounded-xl border border-border bg-surface px-4 py-3 text-base outline-none focus-visible:ring-2 focus-visible:ring-accent"
        />
      </div>

      {data ? (
        <p className="rounded-2xl border border-border bg-accent-soft px-4 py-3 text-sm font-medium">
          {data.nextFeeCents === 0
            ? t("advisor.feeFree")
            : t("advisor.feePaid", { fee: formatMoney(data.nextFeeCents, locale) })}
        </p>
      ) : null}
      <p className="text-xs text-muted">{t("advisor.share")}</p>

      <button
        type="submit"
        disabled={busy || !data}
        className="rounded-full bg-primary px-5 py-3.5 text-base font-semibold text-on-primary disabled:opacity-60"
      >
        {t("advisor.submit")}
      </button>
    </form>
  );
}
