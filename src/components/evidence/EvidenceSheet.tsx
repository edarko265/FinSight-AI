"use client";

import { useEffect, useRef, useState } from "react";

import { CorrectionWizard, type CorrectionTarget } from "@/components/corrections/CorrectionWizard";
import { usePreferences } from "@/components/providers/PreferencesProvider";
import { CloseIcon } from "@/components/ui/icons";
import {
  TAB_SHEET_MAX_H,
  TAB_SHEET_POSITION,
  TabSheetBackdrop,
  useSheetDialog,
} from "@/components/ui/TabSheet";
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
  key: string;
  kindKey: string;
  account: string | null;
  corrected: boolean;
  originalBasket: string;
  originalNecessity: string;
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
  const [correcting, setCorrecting] = useState<CorrectionTarget | null>(null);

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
      setPage(null);
      void load(evidence, 0);
    }
  }, [evidence]);
  // Runs after the effect above, which still sees the dialog closed on the first render of `evidence`.
  const onKeyDown = useSheetDialog(dialogRef, evidence !== null, onClose);

  const label = (prefix: string, value: string): string => {
    const key = `${prefix}.${value}`;
    return hasMessage(key) ? t(key as MessageKey) : value;
  };

  return (
    <>
      {evidence ? <TabSheetBackdrop onClick={onClose} /> : null}
      <dialog
        ref={dialogRef}
        onClose={onClose}
        onKeyDown={onKeyDown}
        aria-labelledby="evidence-title"
        className={`${TAB_SHEET_POSITION} ${TAB_SHEET_MAX_H} h-[80dvh] flex-col bg-background p-0 text-foreground open:flex`}
      >
        <header className="flex items-start justify-between gap-3 border-b border-border px-4 py-3">
          <div>
            <h2 id="evidence-title" className="text-base font-semibold">
              {t("evidence.title")}
            </h2>
            <p className="text-sm text-muted">
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
                  <p className="text-sm text-muted">
                    {formatDay(item.date, locale)} · {label("basket", item.basket)} ·{" "}
                    {label("necessity", item.necessity)}
                    {item.corrected ? ` · ${t("corrections.yours")}` : ""}
                    {item.account ? ` · ${t("accounts.simulated")}` : ""}
                  </p>
                  <button
                    type="button"
                    onClick={() => setCorrecting({ ...item })}
                    className="mt-0.5 text-sm font-semibold text-accent"
                  >
                    {t("corrections.change")}
                  </button>
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
        <CorrectionWizard
          target={correcting}
          onClose={() => setCorrecting(null)}
          onDone={() => {
            if (evidence) void load(evidence, 0);
          }}
        />
      </dialog>
    </>
  );
}
