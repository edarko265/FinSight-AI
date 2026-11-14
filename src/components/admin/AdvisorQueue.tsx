"use client";

import { useEffect, useState } from "react";

import { LoadState } from "@/components/admin/LoadState";
import { RowButton } from "@/components/admin/RowButton";
import { usePreferences } from "@/components/providers/PreferencesProvider";
import { useToast } from "@/components/providers/ToastProvider";
import { PendingLabel } from "@/components/ui/Spinner";
import { useAsyncAction } from "@/components/ui/useAsyncAction";
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
  deleted: boolean;
}

interface Thread extends QueueItem {
  messages: { id: string; sender: "customer" | "advisor"; text: string }[];
}

const POLL_MS = 4000;

/** Null when the request failed, whether by status or by network. */
async function getJson<T>(path: string, init?: RequestInit): Promise<T | null> {
  try {
    const response = await fetch(path, { credentials: "same-origin", ...init });
    return response.ok ? ((await response.json()) as T) : null;
  } catch {
    return null;
  }
}

type Action = "close" | "reopen" | "trash" | "restore" | "purge";

/** Posts an action for one request and returns the fresh queue; throws when the action failed. */
async function postAction(id: string, action: Action): Promise<QueueItem[] | null> {
  const done = await getJson(`/api/admin/advisor/${id}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action }),
  });
  if (done === null) throw new Error("request_failed");
  return (await getJson<{ queue: QueueItem[] }>("/api/admin/advisor"))?.queue ?? null;
}

/** The adviser's side of a hand-over: the queue of requests, and the conversation with one customer. */
export function AdvisorQueue(): React.JSX.Element {
  const { t, locale } = usePreferences();
  const toast = useToast();
  const [queue, setQueue] = useState<QueueItem[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [tick, setTick] = useState(0);
  const [openId, setOpenId] = useState<string | null>(null);
  const [thread, setThread] = useState<Thread | null>(null);
  const [draft, setDraft] = useState("");

  useEffect(() => {
    let cancelled = false;
    let first = true;
    const load = (): void => {
      void getJson<{ queue: QueueItem[] }>("/api/admin/advisor").then((data) => {
        if (cancelled) return;
        if (data) {
          setQueue(data.queue);
          setFailed(false);
        } else setFailed(true);
      });
      if (openId) {
        const opening = first;
        void getJson<{ thread: Thread }>(`/api/admin/advisor/${openId}`).then((data) => {
          if (cancelled) return;
          if (data) setThread(data.thread);
          else if (opening) {
            // The thread never arrived: go back to the queue instead of waiting forever.
            toast.fail("common.loadFailed");
            setOpenId(null);
          }
        });
      }
      first = false;
    };
    load();
    const timer = window.setInterval(load, POLL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [openId, tick, toast]);

  const retry = (): void => {
    setFailed(false);
    setTick((value) => value + 1);
  };

  const sendReply = useAsyncAction(
    async (text: string): Promise<void> => {
      const data = await getJson<{ thread: Thread }>(`/api/admin/advisor/${openId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      if (!data) throw new Error("request_failed");
      setThread(data.thread);
      setDraft("");
    },
    { successKey: "toast.sent", errorKey: "common.saveFailed" },
  );
  const changeStatus = useAsyncAction(
    async (action: "close" | "reopen"): Promise<void> => {
      const data = await getJson<{ thread: Thread }>(`/api/admin/advisor/${openId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      if (!data) throw new Error("request_failed");
      setThread(data.thread);
    },
    { errorKey: "common.saveFailed" },
  );

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
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <span className="text-muted">{t("advisor.status.closed")}</span>
            <RowButton
              pending={changeStatus.pending}
              pendingLabel={t("common.saving")}
              onClick={() => void changeStatus.run("reopen")}
              className="min-h-11 font-semibold text-accent"
            >
              {t("admin.advisor.reopen")}
            </RowButton>
          </div>
        ) : (
          <form
            className="flex flex-wrap items-center gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              const text = draft.trim();
              if (!text || sendReply.pending) return;
              void sendReply.run(text);
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
              aria-disabled={sendReply.pending}
              className="min-h-11 rounded-full bg-primary px-4 py-2.5 text-sm font-semibold text-on-primary aria-disabled:opacity-60"
            >
              {sendReply.pending ? (
                <PendingLabel>{t("common.sending")}</PendingLabel>
              ) : (
                t("admin.advisor.send")
              )}
            </button>
            <button
              type="button"
              aria-disabled={changeStatus.pending}
              onClick={() => {
                if (!changeStatus.pending) void changeStatus.run("close");
              }}
              className="min-h-11 rounded-full border border-border px-4 py-2.5 text-sm font-semibold aria-disabled:opacity-60"
            >
              {changeStatus.pending ? (
                <PendingLabel>{t("common.saving")}</PendingLabel>
              ) : (
                t("admin.advisor.close")
              )}
            </button>
          </form>
        )}
      </div>
    );
  }

  const live = queue?.filter((item) => !item.deleted) ?? [];
  const binned = queue?.filter((item) => item.deleted) ?? [];

  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs text-muted">{t("admin.advisor.note")}</p>
      <LoadState show={!queue} failed={failed} onRetry={retry} />
      {queue && live.length === 0 ? (
        <p className="text-sm text-muted">{t("admin.advisor.empty")}</p>
      ) : null}
      <ul className="flex flex-col gap-2">
        {live.map((item) => (
          <QueueRow
            key={item.id}
            item={item}
            opening={openId === item.id}
            busyOpening={openId !== null}
            fee={fee(item.feeCents)}
            onOpen={() => setOpenId(item.id)}
            onQueue={setQueue}
          />
        ))}
      </ul>

      {binned.length > 0 ? (
        <div className="flex flex-col gap-2">
          <h3 className="text-sm font-semibold">{t("admin.bin")}</h3>
          <ul className="flex flex-col gap-2">
            {binned.map((item) => (
              <QueueRow key={item.id} item={item} fee="" onQueue={setQueue} />
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

function QueueRow({
  item,
  fee,
  opening = false,
  busyOpening = false,
  onOpen,
  onQueue,
}: {
  item: QueueItem;
  fee: string;
  /** This row's thread is being fetched. */
  opening?: boolean;
  /** Some row's thread is being fetched, so opening another is ignored. */
  busyOpening?: boolean;
  onOpen?: () => void;
  onQueue: (queue: QueueItem[]) => void;
}): React.JSX.Element {
  const { t, locale } = usePreferences();
  const toast = useToast();
  const [which, setWhich] = useState<Action>("trash");
  const { run, pending } = useAsyncAction(async (action: Action): Promise<void> => {
    const fresh = await postAction(item.id, action);
    if (fresh) onQueue(fresh);
    toast.notify(
      action === "trash"
        ? "toast.movedToBin"
        : action === "restore"
          ? "toast.restored"
          : action === "purge"
            ? "toast.deleted"
            : "toast.updated",
    );
  });
  const start = (action: Action): void => {
    setWhich(action);
    void run(action);
  };
  const topic = t(`advisor.topic.${item.topic}` as MessageKey);

  if (item.deleted) {
    return (
      <li className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-dashed border-border px-4 py-3 text-sm">
        <span className="text-muted">
          {item.alias} · {topic}
        </span>
        <span className="flex gap-4 font-semibold">
          <RowButton
            pending={pending}
            active={which === "restore"}
            pendingLabel={t("common.restoring")}
            onClick={() => start("restore")}
            className="min-h-11 text-accent"
          >
            {t("common.restore")}
          </RowButton>
          <RowButton
            pending={pending}
            active={which === "purge"}
            pendingLabel={t("common.deleting")}
            onClick={() => start("purge")}
            className="min-h-11 text-warning"
          >
            {t("common.deleteForever")}
          </RowButton>
        </span>
      </li>
    );
  }
  return (
    <li className="rounded-xl border border-border px-4 py-3 text-sm">
      <button
        type="button"
        aria-disabled={busyOpening}
        onClick={() => {
          if (!busyOpening) onOpen?.();
        }}
        className="flex w-full flex-wrap items-center justify-between gap-2 text-left"
      >
        <span className="flex flex-col">
          <span className="font-semibold">
            {item.alias} · {topic}
          </span>
          <span className="text-xs text-muted">
            {t("admin.advisor.call")} {formatSlot(item.slot, locale)} · {fee}
          </span>
        </span>
        <span
          className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
            item.waitingForAdvisor ? "bg-warning-soft text-warning" : "bg-accent-soft text-accent"
          }`}
        >
          {opening ? (
            <PendingLabel>{t("common.loading")}</PendingLabel>
          ) : item.waitingForAdvisor ? (
            t("admin.advisor.needsReply")
          ) : (
            t(`advisor.status.${item.status}` as MessageKey)
          )}
        </span>
      </button>
      <div className="mt-2 flex gap-4 text-xs font-semibold">
        {item.status === "closed" ? (
          <RowButton
            pending={pending}
            active={which === "reopen"}
            pendingLabel={t("common.saving")}
            onClick={() => start("reopen")}
            className="min-h-11 text-accent"
          >
            {t("admin.advisor.reopen")}
          </RowButton>
        ) : null}
        <RowButton
          pending={pending}
          active={which === "trash"}
          pendingLabel={t("common.deleting")}
          onClick={() => start("trash")}
          className="min-h-11 text-muted"
        >
          {t("common.moveToBin")}
        </RowButton>
      </div>
    </li>
  );
}
