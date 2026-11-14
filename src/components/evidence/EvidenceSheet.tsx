"use client";

import { useEffect, useRef, useState } from "react";

import { CorrectionWizard, type CorrectionTarget } from "@/components/corrections/CorrectionWizard";
import { usePreferences } from "@/components/providers/PreferencesProvider";
import { CloseIcon } from "@/components/ui/icons";
import { LoadError } from "@/components/ui/LoadError";
import { LoadingRegion, SkeletonList } from "@/components/ui/Skeleton";
import { PendingLabel, Spinner } from "@/components/ui/Spinner";
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
  manual?: boolean;
  note?: string | null;
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
  /** Offset of the request in flight, or null. */
  const [loadingOffset, setLoadingOffset] = useState<number | null>(null);
  /** Offset of the request that failed last, or null. */
  const [failedOffset, setFailedOffset] = useState<number | null>(null);
  const requestId = useRef(0);
  const focusAfterRetry = useRef(false);
  const contentRef = useRef<HTMLDivElement>(null);
  const loading = loadingOffset !== null;
  const [correcting, setCorrecting] = useState<CorrectionTarget | null>(null);

  async function load(ref: EvidenceRef, offset: number, retry = false): Promise<void> {
    // A newer request, or closing the sheet, makes this one stale.
    const id = ++requestId.current;
    setLoadingOffset(offset);
    setFailedOffset(null);
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
      if (id !== requestId.current) return;
      focusAfterRetry.current = retry;
      setPage((current) =>
        offset === 0 || !current ? next : { ...next, items: [...current.items, ...next.items] },
      );
    } catch {
      // Keep what is already shown; the retry button below reloads this offset.
      if (id === requestId.current) setFailedOffset(offset);
    } finally {
      if (id === requestId.current) setLoadingOffset(null);
    }
  }

  // After a successful retry the retry button is gone, so move focus to the content.
  useEffect(() => {
    if (focusAfterRetry.current && !loading && failedOffset === null) {
      focusAfterRetry.current = false;
      contentRef.current?.focus();
    }
  }, [page, loading, failedOffset]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (evidence && !dialog.open) {
      setPage(null);
      void load(evidence, 0);
    } else if (!evidence) {
      // Closing makes any request still in flight stale; opening starts from a clean state.
      requestId.current += 1;
    }
  }, [evidence]);
  // Runs after the effect above, which still sees the dialog closed on the first render of `evidence`.
  const dismiss = useSheetDialog(dialogRef, evidence !== null, () => onClose());

  const label = (prefix: string, value: string): string => {
    const key = `${prefix}.${value}`;
    return hasMessage(key) ? t(key as MessageKey) : value;
  };

  return (
    <>
      {evidence ? <TabSheetBackdrop onClick={() => dismiss("backdrop")} /> : null}
      <dialog
        ref={dialogRef}
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

        <div
          ref={contentRef}
          tabIndex={-1}
          className="flex-1 overflow-y-auto px-4 py-2 outline-none"
        >
          {!page && loading ? (
            <LoadingRegion className="py-2">
              <SkeletonList rows={5} />
            </LoadingRegion>
          ) : null}
          {page && loadingOffset === 0 ? (
            <LoadingRegion
              labelKey="common.refreshing"
              className="flex items-center gap-2 py-2 text-sm text-muted"
            >
              <Spinner />
              <span aria-hidden="true">{t("common.refreshing")}</span>
            </LoadingRegion>
          ) : null}
          {failedOffset === 0 ? (
            <LoadError className="my-2" onRetry={() => evidence && void load(evidence, 0, true)} />
          ) : null}
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
          {page && failedOffset !== null && failedOffset > 0 ? (
            <LoadError
              className="my-3"
              onRetry={() => evidence && void load(evidence, failedOffset, true)}
            />
          ) : null}
          {page &&
          page.items.length < page.total &&
          (failedOffset === null || failedOffset === 0) ? (
            <button
              type="button"
              aria-disabled={loading}
              onClick={() => {
                if (!loading && evidence) void load(evidence, page.items.length);
              }}
              className="my-3 min-h-11 w-full rounded-full border border-border bg-surface px-4 py-2.5 text-sm font-medium aria-disabled:opacity-50"
            >
              {loadingOffset !== null && loadingOffset > 0 ? (
                <PendingLabel>{t("common.loading")}</PendingLabel>
              ) : (
                t("evidence.more")
              )}
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
