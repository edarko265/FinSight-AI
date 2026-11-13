"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";

import { usePreferences } from "@/components/providers/PreferencesProvider";
import type { MessageKey } from "@/lib/i18n/translate";

const POINTS: MessageKey[] = [
  "consent.point.sent",
  "consent.point.notSent",
  "consent.point.voice",
  "consent.point.advice",
  "consent.point.choice",
];

/** Terms for the AI coach. Shown before any question is sent to an AI service. */
export function ConsentSheet({
  open,
  onChoose,
}: {
  open: boolean;
  onChoose: (accepted: boolean) => void;
}): React.JSX.Element {
  const { t } = usePreferences();
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={dialogRef}
      onCancel={(event) => {
        event.preventDefault();
        onChoose(false);
      }}
      aria-labelledby="consent-title"
      className="m-0 mx-auto mt-auto max-h-[92dvh] w-full max-w-md flex-col rounded-t-3xl bg-background p-0 text-foreground backdrop:bg-black/50 open:flex"
    >
      <div className="flex-1 overflow-y-auto px-5 pt-5">
        <h2 id="consent-title" className="text-lg font-semibold">
          {t("consent.title")}
        </h2>
        <p className="mt-2 text-sm text-muted">{t("consent.intro")}</p>
        <ul className="mt-4 flex flex-col gap-3">
          {POINTS.map((key) => (
            <li key={key} className="flex gap-2.5 text-sm">
              <span
                className="mt-1.5 size-1.5 shrink-0 rounded-full bg-accent"
                aria-hidden="true"
              />
              <span>{t(key)}</span>
            </li>
          ))}
        </ul>
        <Link href="/privacy" className="mt-4 inline-block text-sm font-medium text-accent">
          {t("consent.readMore")}
        </Link>
      </div>
      <div className="flex flex-col gap-2 px-5 pt-4 pb-5">
        <button
          type="button"
          onClick={() => onChoose(true)}
          className="rounded-full bg-primary px-5 py-3.5 text-base font-semibold text-on-primary"
        >
          {t("consent.accept")}
        </button>
        <button
          type="button"
          onClick={() => onChoose(false)}
          className="rounded-full border border-border px-5 py-3 text-sm font-semibold"
        >
          {t("consent.decline")}
        </button>
      </div>
    </dialog>
  );
}
