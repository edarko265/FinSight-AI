"use client";

import { useEffect, useRef, useState } from "react";

import { usePreferences } from "@/components/providers/PreferencesProvider";
import { CloseIcon } from "@/components/ui/icons";
import { api } from "@/lib/api-client";
import type { EvidenceRef } from "@/lib/contracts/chat";
import { formatDay, formatMoney } from "@/lib/i18n/config";
import { hasMessage, type MessageKey } from "@/lib/i18n/translate";

interface EvidenceItem {
  date: string;
  time: string;
  amountCents: number;
  category: string;
  mcc: string | null;
  merchantId: string | null;
  basket: string;
  necessity: string;
}

interface EvidencePage {
  total: number;
  totalCents: number;
  items: EvidenceItem[];
}

const PAGE = 20;

/** The transactions behind an answer, so any figure can be checked by the person it belongs to. */
export function EvidenceSheet({
  evidence,
  onClose,
}: {
  evidence: EvidenceRef | null;
  onClose: () => void;
}): React.JSX.Element {
  const { t, locale } = usePreferences();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [page, setPage] = useState<EvidencePage | null>(null);
  const [loading, setLoading] = useState(false);

  async function load(ref: EvidenceRef, offset: number): Promise<void> {
    setLoading(true);
    const params = new URLSearchParams({
      start: ref.startInclusive,
      end: ref.endExclusive,
      offset: String(offset),
      limit: String(PAGE),
    });
    if (ref.categories?.length) params.set("categories", ref.categories.join(","));
    if (ref.mccs?.length) params.set("mccs", ref.mccs.join(","));
    try {
      const next = await api<EvidencePage>(`/api/transactions?${params.toString()}`);
      setPage((current) =>
        offset === 0 || !current ? next : { ...next, items: [...current.items, ...next.items] },
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (evidence && !dialog.open) {
      dialog.showModal();
      setPage(null);
      void load(evidence, 0);
    }
    if (!evidence && dialog.open) dialog.close();
  }, [evidence]);

  const label = (prefix: string, value: string): string => {
    const key = `${prefix}.${value}`;
    return hasMessage(key) ? t(key as MessageKey) : value;
  };

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      aria-labelledby="evidence-title"
      className="m-0 mx-auto mt-auto h-[80dvh] w-full max-w-md flex-col rounded-t-3xl bg-background p-0 text-foreground backdrop:bg-black/50 open:flex"
    >
      <header className="flex items-start justify-between gap-3 border-b border-border px-4 py-3">
        <div>
          <h2 id="evidence-title" className="text-base font-semibold">
            {t("evidence.title")}
          </h2>
          <p className="text-xs text-muted">
            {evidence?.periodLabel}
            {page
              ? ` · ${t("evidence.count", { count: page.total })} · ${formatMoney(page.totalCents, locale)}`
              : ""}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label={t("evidence.close")}
          className="-m-1 rounded-full p-1 text-muted"
        >
          <CloseIcon />
        </button>
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-2">
        {page && page.items.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted">{t("evidence.empty")}</p>
        ) : null}
        <ul className="divide-y divide-border">
          {page?.items.map((item, index) => (
            <li
              key={`${item.date}-${item.time}-${index}`}
              className="flex items-center justify-between gap-3 py-2.5"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{label("cat", item.category)}</p>
                <p className="text-xs text-muted">
                  {formatDay(item.date, locale)} · {label("basket", item.basket)} ·{" "}
                  {label("necessity", item.necessity)}
                </p>
              </div>
              <span className="shrink-0 text-sm font-medium tabular-nums">
                {formatMoney(-item.amountCents, locale)}
              </span>
            </li>
          ))}
        </ul>
        {page && page.items.length < page.total ? (
          <button
            type="button"
            disabled={loading}
            onClick={() => evidence && void load(evidence, page.items.length)}
            className="my-3 w-full rounded-full border border-border bg-surface px-4 py-2.5 text-sm font-medium disabled:opacity-50"
          >
            {t("evidence.more")}
          </button>
        ) : null}
      </div>
    </dialog>
  );
}
