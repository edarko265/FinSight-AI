"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { usePreferences } from "@/components/providers/PreferencesProvider";
import { SendIcon } from "@/components/ui/icons";
import { LoadError } from "@/components/ui/LoadError";
import { LoadingRegion, Skeleton, SkeletonText } from "@/components/ui/Skeleton";
import { Spinner } from "@/components/ui/Spinner";
import { useAsyncAction } from "@/components/ui/useAsyncAction";
import { Suggestions, Wizard, WizardChoices, WizardReview } from "@/components/ui/Wizard";
import { api } from "@/lib/api-client";
import { isApiError } from "@/lib/async-action";
import { formatMoney, formatSlot } from "@/lib/i18n/config";
import type { MessageKey } from "@/lib/i18n/translate";
import { InfoTip } from "@/components/ui/InfoTip";

interface Message {
  id: string;
  sender: "customer" | "advisor";
  text: string;
  author?: string;
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
  payments: {
    id: string;
    amountCents: number;
    reference: string;
    simulated: boolean;
    at: string;
  }[];
  paymentsSimulated: boolean;
}

const POLL_MS = 4000;

/** Hand-over to a human adviser: request one and book a call, then continue the conversation with them. */
export function AdvisorView(): React.JSX.Element {
  const { t, locale } = usePreferences();
  const [data, setData] = useState<Payload | null>(null);
  const [failed, setFailed] = useState(false);
  const [tick, setTick] = useState(0);
  const [topic, setTopic] = useState<"general" | "investment">("general");
  const [slot, setSlot] = useState("");
  const [note, setNote] = useState("");
  const [draft, setDraft] = useState("");
  const [open, setOpen] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const retried = useRef(false);

  useEffect(() => {
    let cancelled = false;
    let loaded = false;
    const load = (): void => {
      api<Payload>("/api/advisor")
        .then((payload) => {
          if (cancelled) return;
          loaded = true;
          setData(payload);
          setFailed(false);
          if (retried.current) {
            retried.current = false;
            const active = document.activeElement;
            if (!active || active === document.body) headingRef.current?.focus();
          }
        })
        .catch((error: unknown) => {
          // Polling stays quiet once there is something to show.
          if (!cancelled && !loaded && !isApiError(error, 401)) setFailed(true);
        });
    };
    load();
    const timer = window.setInterval(load, POLL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [tick]);

  const messageCount = data?.request?.messages.length ?? 0;
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [messageCount]);

  const create = useAsyncAction(
    async (payload: Payload) => {
      const { request: created } = await api<{ request: AdvisorRequest }>("/api/advisor", {
        method: "POST",
        json: { topic, slot: slot || payload.slots[0], note, pay: payload.nextFeeCents > 0 },
      });
      return created;
    },
    { successKey: "toast.requestSent" },
  );
  const reply = useAsyncAction(async (text: string) => {
    const { request } = await api<{ request: AdvisorRequest }>("/api/advisor/messages", {
      method: "POST",
      json: { text },
    });
    return request;
  });

  async function submit(): Promise<boolean> {
    if (!data) return false;
    const result = await create.run(data);
    if (!result.ok) return false;
    setOpen(false);
    setData((current) => current && { ...current, request: result.value });
    return true;
  }

  async function send(event: React.FormEvent): Promise<void> {
    event.preventDefault();
    const text = draft.trim();
    if (!text || !data) return;
    // The draft is only cleared once the message is delivered, so a failure loses nothing.
    const result = await reply.run(text);
    if (!result.ok) return;
    setDraft("");
    setData((current) => current && { ...current, request: result.value });
  }

  const request = data?.request;

  if (request) {
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="border-b border-border bg-surface px-4 py-3">
          <p className="text-sm font-semibold">
            {t(`advisor.status.${request.status}` as MessageKey)}
          </p>
          <p className="text-sm text-muted">
            {t(`advisor.topic.${request.topic}` as MessageKey)} ·{" "}
            {t("advisor.booked", { slot: formatSlot(request.slot, locale) })}
          </p>
          {request.feeCents > 0 && data?.payments[0] ? (
            <p className="mt-1 text-xs text-muted">
              {t(data.payments[0].simulated ? "advisor.receipt.simulated" : "advisor.receipt", {
                amount: formatMoney(data.payments[0].amountCents, locale),
                reference: data.payments[0].reference,
              })}
            </p>
          ) : null}
        </div>
        <div className="flex-1 overflow-y-auto px-4 py-4">
          <ol className="flex flex-col gap-3" aria-live="polite">
            <li className="self-center rounded-full bg-accent-soft px-3 py-1.5 text-center text-sm">
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
                <span className="mb-0.5 block text-xs font-semibold opacity-80">
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
              aria-disabled={reply.pending}
              aria-label={reply.pending ? t("common.sending") : t("chat.send")}
              className="rounded-full bg-primary p-3 text-on-primary disabled:opacity-40"
            >
              {reply.pending ? <Spinner size="md" /> : <SendIcon className="size-5" />}
            </button>
          </form>
          <Link href="/chat" className="mt-2 block text-center text-sm font-medium text-accent">
            {t("advisor.backToCoach")}
          </Link>
        </div>
      </div>
    );
  }

  const chosenSlot = slot || data?.slots[0] || "";
  const fee = data?.nextFeeCents ?? 0;
  const notes: MessageKey[] = [
    "advisor.suggest.start",
    "advisor.suggest.tight",
    "advisor.suggest.goal",
    "advisor.suggest.pension",
  ];

  return (
    <div className="flex flex-col gap-5 px-4 py-4">
      <div>
        <InfoTip
          lead={
            <h1 ref={headingRef} tabIndex={-1} className="text-xl font-semibold focus:outline-none">
              {t("advisor.title")}
            </h1>
          }
        >
          {t("advisor.intro")}
        </InfoTip>
      </div>

      {failed && !data ? (
        <LoadError
          onRetry={() => {
            retried.current = true;
            setFailed(false);
            setTick((value) => value + 1);
          }}
        />
      ) : null}
      {!data && !failed ? (
        <LoadingRegion className="flex flex-col gap-3">
          <Skeleton className="h-12 w-full rounded-2xl" />
          <SkeletonText lines={2} />
        </LoadingRegion>
      ) : null}

      {data ? (
        <p className="rounded-2xl border border-border bg-accent-soft px-4 py-3 text-sm font-medium">
          {fee === 0
            ? t("advisor.feeFree")
            : t("advisor.feePaid", { fee: formatMoney(fee, locale) })}
        </p>
      ) : null}

      <button
        type="button"
        disabled={!data}
        onClick={() => setOpen(true)}
        className="rounded-full bg-primary px-5 py-3.5 text-base font-semibold text-on-primary disabled:opacity-60"
      >
        {t("advisor.submit")}
      </button>
      <Link href="/chat" className="text-center text-sm font-medium text-accent">
        {t("advisor.backToCoach")}
      </Link>

      <Wizard
        open={open}
        title={t("advisor.title")}
        finishLabel={t(fee > 0 ? "advisor.pay.confirm" : "advisor.submit")}
        onClose={() => setOpen(false)}
        onFinish={submit}
        steps={[
          {
            title: t("advisor.topic"),
            hint: t("advisor.step.topicHint"),
            valid: true,
            content: (
              <WizardChoices
                name="advisor-topic"
                value={topic}
                onChange={setTopic}
                options={(["general", "investment"] as const).map((option) => ({
                  value: option,
                  label: t(`advisor.topic.${option}` as MessageKey),
                }))}
              />
            ),
          },
          {
            title: t("advisor.slot"),
            hint: t("advisor.step.slotHint"),
            valid: chosenSlot !== "",
            content: (
              <WizardChoices
                name="advisor-slot"
                value={chosenSlot}
                onChange={setSlot}
                options={(data?.slots ?? []).map((option) => ({
                  value: option,
                  label: formatSlot(option, locale),
                }))}
              />
            ),
          },
          {
            title: t("advisor.note"),
            hint: t("advisor.step.noteHint"),
            valid: note.trim().length > 0,
            content: (
              <>
                <label className="flex flex-col gap-1.5 text-sm font-medium">
                  {t("advisor.note")}
                  <textarea
                    value={note}
                    onChange={(event) => setNote(event.target.value)}
                    placeholder={t("advisor.notePlaceholder")}
                    maxLength={1000}
                    rows={3}
                    autoFocus
                    className="rounded-xl border border-border bg-surface px-4 py-3 text-base font-normal outline-none focus-visible:ring-2 focus-visible:ring-accent"
                  />
                </label>
                <Suggestions
                  label={t("wizard.suggestions")}
                  options={notes.map((key) => ({ label: t(key), value: t(key) }))}
                  onPick={setNote}
                />
              </>
            ),
          },
          {
            title: t("wizard.review"),
            hint: t("advisor.share"),
            valid: true,
            content: (
              <WizardReview
                rows={[
                  {
                    label: t("advisor.review.topic"),
                    value: t(`advisor.topic.${topic}` as MessageKey),
                  },
                  {
                    label: t("advisor.review.slot"),
                    value: chosenSlot ? formatSlot(chosenSlot, locale) : "—",
                  },
                  {
                    label: t("advisor.review.fee"),
                    value: fee === 0 ? t("advisor.review.free") : formatMoney(fee, locale),
                  },
                ]}
              />
            ),
          },
          ...(fee > 0
            ? [
                {
                  title: t("advisor.pay.title"),
                  hint: t("advisor.pay.hint"),
                  valid: true,
                  content: (
                    <div className="flex flex-col gap-3 text-sm">
                      <p className="rounded-2xl bg-brand px-4 py-4 text-center text-2xl font-semibold text-on-brand tabular-nums">
                        {formatMoney(fee, locale)}
                      </p>
                      <p className="rounded-xl border border-warning bg-warning-soft px-3 py-2">
                        {t("advisor.pay.simulated")}
                      </p>
                      <p className="text-muted">{t("advisor.pay.real")}</p>
                    </div>
                  ),
                },
              ]
            : []),
        ]}
      />
    </div>
  );
}
