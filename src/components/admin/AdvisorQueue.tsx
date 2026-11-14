"use client";

import { useEffect, useState } from "react";

import { usePreferences } from "@/components/providers/PreferencesProvider";
import { formatMoney, formatSlot } from "@/lib/i18n/config";
import type { MessageKey } from "@/lib/i18n/translate";

interface QueueItem {
  id: string;
  alias: string;
  topic: "general" | "investment";
  status: "open" | "active" | "closed";
  slot: string;
  feeCents: number;
  waitingForAdvisor: boolean;
}

interface Thread extends QueueItem {
  messages: { id: string; sender: "customer" | "advisor"; text: string }[];
}

const POLL_MS = 4000;

async function getJson<T>(path: string, init?: RequestInit): Promise<T | null> {
  const response = await fetch(path, { credentials: "same-origin", ...init });
  return response.ok ? ((await response.json()) as T) : null;
}

/** The adviser's side of a hand-over: the queue of requests, and the conversation with one customer. */
export function AdvisorQueue(): React.JSX.Element {
  const { t, locale } = usePreferences();
  const [queue, setQueue] = useState<QueueItem[] | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [thread, setThread] = useState<Thread | null>(null);
  const [draft, setDraft] = useState("");

  useEffect(() => {
    let cancelled = false;
    const load = (): void => {
      void getJson<{ queue: QueueItem[] }>("/api/admin/advisor").then((data) => {
        if (!cancelled && data) setQueue(data.queue);
      });
      if (openId) {
        void getJson<{ thread: Thread }>(`/api/admin/advisor/${openId}`).then((data) => {
          if (!cancelled && data) setThread(data.thread);
        });
      }
    };
    load();
    const timer = window.setInterval(load, POLL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [openId]);

  async function post(payload: { text: string } | { action: "close" }): Promise<void> {
    if (!openId) return;
    const data = await getJson<{ thread: Thread }>(`/api/admin/advisor/${openId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (data) setThread(data.thread);
  }

  const fee = (cents: number): string =>
    cents === 0 ? t("admin.advisor.free") : formatMoney(cents, locale);

  if (openId && thread && thread.id === openId) {
    return (
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
          <button
            type="button"
            onClick={() => {
              setOpenId(null);
              setThread(null);
            }}
            className="font-semibold text-accent"
          >
            ← {t("admin.advisor.back")}
          </button>
          <span className="text-muted">
            {thread.alias} · {t(`advisor.topic.${thread.topic}` as MessageKey)} ·{" "}
            {t("admin.advisor.call")} {formatSlot(thread.slot, locale)} · {t("admin.advisor.fee")}:{" "}
            {fee(thread.feeCents)}
          </span>
        </div>
        <ol className="flex max-h-80 flex-col gap-2 overflow-y-auto rounded-xl bg-background p-3">
          {thread.messages.map((message) => (
            <li
              key={message.id}
              className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${
                message.sender === "advisor"
                  ? "self-end bg-brand text-on-brand"
                  : "self-start bg-surface shadow-sm"
              }`}
            >
              {message.text}
            </li>
          ))}
        </ol>
        {thread.status === "closed" ? (
          <p className="text-sm text-muted">{t("advisor.status.closed")}</p>
        ) : (
          <form
            className="flex flex-wrap items-center gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              const text = draft.trim();
              if (!text) return;
              setDraft("");
              void post({ text });
            }}
          >
            <label htmlFor="adviser-reply" className="sr-only">
              {t("admin.advisor.reply")}
            </label>
            <input
              id="adviser-reply"
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder={t("admin.advisor.reply")}
              autoComplete="off"
              className="min-w-0 flex-1 rounded-full border border-border bg-background px-4 py-2.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-accent"
            />
            <button
              type="submit"
              className="rounded-full bg-primary px-4 py-2.5 text-sm font-semibold text-on-primary"
            >
              {t("admin.advisor.send")}
            </button>
            <button
              type="button"
              onClick={() => void post({ action: "close" })}
              className="rounded-full border border-border px-4 py-2.5 text-sm font-semibold"
            >
              {t("admin.advisor.close")}
            </button>
          </form>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs text-muted">{t("admin.advisor.note")}</p>
      {queue && queue.length === 0 ? (
        <p className="text-sm text-muted">{t("admin.advisor.empty")}</p>
      ) : null}
      <ul className="flex flex-col gap-2">
        {queue?.map((item) => (
          <li key={item.id}>
            <button
              type="button"
              onClick={() => setOpenId(item.id)}
              className="flex w-full flex-wrap items-center justify-between gap-2 rounded-xl border border-border px-4 py-3 text-left text-sm"
            >
              <span className="flex flex-col">
                <span className="font-semibold">
                  {item.alias} · {t(`advisor.topic.${item.topic}` as MessageKey)}
                </span>
                <span className="text-xs text-muted">
                  {t("admin.advisor.call")} {formatSlot(item.slot, locale)} · {fee(item.feeCents)}
                </span>
              </span>
              <span
                className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                  item.waitingForAdvisor
                    ? "bg-warning-soft text-warning"
                    : "bg-accent-soft text-accent"
                }`}
              >
                {item.waitingForAdvisor
                  ? t("admin.advisor.needsReply")
                  : t(`advisor.status.${item.status}` as MessageKey)}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
