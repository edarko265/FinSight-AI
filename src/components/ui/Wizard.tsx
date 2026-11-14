"use client";

import { useEffect, useRef, useState } from "react";

import { usePreferences } from "@/components/providers/PreferencesProvider";
import { CloseIcon } from "@/components/ui/icons";

export interface WizardStep {
  title: string;
  /** Tells the user what to enter on this step. */
  hint: string;
  content: React.ReactNode;
  /** Whether the step is filled in well enough to move on. */
  valid: boolean;
}

interface WizardProps {
  open: boolean;
  title: string;
  steps: WizardStep[];
  finishLabel: string;
  onClose: () => void;
  onFinish: () => Promise<void | boolean> | void | boolean;
  /** Shown above the buttons, for example when saving failed. */
  error?: string | null;
  /** False for a step the user must complete, such as accepting terms: no close button, no Escape. */
  dismissable?: boolean;
}

/**
 * Every form in the app is one of these: opened by a button, filled in one
 * question at a time, with progress visible from the first step and a hint on
 * each step saying what to enter.
 */
export function Wizard({
  open,
  title,
  steps,
  finishLabel,
  onClose,
  onFinish,
  error,
  dismissable = true,
}: WizardProps): React.JSX.Element {
  const { t } = usePreferences();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [index, setIndex] = useState(0);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  const close = (): void => {
    setIndex(0);
    setBusy(false);
    onClose();
  };

  const current = Math.min(index, steps.length - 1);
  const step = steps[current];
  const last = current === steps.length - 1;

  async function advance(event: React.FormEvent): Promise<void> {
    event.preventDefault();
    if (!step?.valid || busy) return;
    if (!last) {
      setIndex(current + 1);
      return;
    }
    setBusy(true);
    try {
      // Returning false means the save was refused: stay on this step so nothing typed is lost.
      if ((await onFinish()) !== false) setIndex(0);
    } finally {
      setBusy(false);
    }
  }

  return (
    <dialog
      ref={dialogRef}
      onClose={close}
      onCancel={(event) => {
        if (!dismissable) event.preventDefault();
      }}
      aria-labelledby="wizard-title"
      className="m-0 mx-auto mt-auto max-h-[92dvh] w-full max-w-md flex-col rounded-t-3xl md:my-auto md:max-w-lg md:rounded-3xl bg-background p-0 text-foreground backdrop:bg-black/50 open:flex"
    >
      <header className="flex items-center justify-between gap-3 px-5 pt-5">
        <h2 id="wizard-title" className="text-base font-semibold">
          {title}
        </h2>
        {dismissable ? (
          <button
            type="button"
            onClick={close}
            aria-label={t("evidence.close")}
            className="-m-1 rounded-full p-1 text-muted"
          >
            <CloseIcon />
          </button>
        ) : null}
      </header>

      <div className="px-5 pt-3">
        <p className="text-xs font-medium text-muted" aria-live="polite">
          {t("wizard.step", { current: current + 1, total: steps.length })}
        </p>
        <ol className="mt-2 flex gap-1.5" aria-hidden="true">
          {steps.map((item, position) => (
            <li
              key={item.title}
              className={`h-1.5 flex-1 rounded-full ${position <= current ? "bg-accent" : "bg-border"}`}
            />
          ))}
        </ol>
      </div>

      {open && step ? (
        <form onSubmit={(event) => void advance(event)} className="flex min-h-0 flex-1 flex-col">
          <div className="flex-1 overflow-y-auto px-5 pt-5 pb-2">
            <h3 className="text-xl font-semibold tracking-tight">{step.title}</h3>
            <p className="mt-1 text-sm text-muted">{step.hint}</p>
            <div className="mt-4">{step.content}</div>
          </div>
          {error ? (
            <p
              role="alert"
              className="mx-5 rounded-xl bg-warning-soft px-3 py-2 text-sm text-warning"
            >
              {error}
            </p>
          ) : null}
          <div className="flex gap-2 px-5 pt-3 pb-5">
            {current > 0 ? (
              <button
                type="button"
                onClick={() => setIndex(current - 1)}
                className="rounded-full border border-border px-5 py-3 text-sm font-semibold"
              >
                {t("wizard.back")}
              </button>
            ) : null}
            <button
              type="submit"
              disabled={!step.valid || busy}
              className="flex-1 rounded-full bg-primary px-5 py-3 text-sm font-semibold text-on-primary disabled:opacity-40"
            >
              {last ? finishLabel : t("wizard.next")}
            </button>
          </div>
        </form>
      ) : null}
    </dialog>
  );
}

/** Tap-to-fill suggestions shown under a field. */
export function Suggestions({
  label,
  options,
  onPick,
}: {
  label: string;
  options: readonly { label: string; value: string }[];
  onPick: (value: string) => void;
}): React.JSX.Element {
  return (
    <div className="mt-3">
      <p className="text-xs font-medium text-muted">{label}</p>
      <ul className="mt-1.5 flex flex-wrap gap-2">
        {options.map((option) => (
          <li key={option.value}>
            <button
              type="button"
              onClick={() => onPick(option.value)}
              className="rounded-full border border-border bg-surface px-3 py-1.5 text-sm font-medium"
            >
              {option.label}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** A labelled text field styled for wizard steps. */
export function WizardField({
  label,
  ...props
}: { label: string } & React.InputHTMLAttributes<HTMLInputElement>): React.JSX.Element {
  return (
    <label className="flex flex-col gap-1.5 text-sm font-medium">
      {label}
      <input
        {...props}
        className="rounded-xl border border-border bg-surface px-4 py-3 text-base font-normal outline-none focus-visible:ring-2 focus-visible:ring-accent"
      />
    </label>
  );
}

/** A list of choices where one is picked. */
export function WizardChoices<T extends string>({
  name,
  options,
  value,
  onChange,
}: {
  name: string;
  options: readonly { value: T; label: string; note?: string }[];
  value: T;
  onChange: (value: T) => void;
}): React.JSX.Element {
  return (
    <div role="radiogroup" className="flex flex-col gap-2">
      {options.map((option) => (
        <label
          key={option.value}
          className={`flex items-center gap-3 rounded-2xl border px-4 py-3 text-sm ${
            value === option.value ? "border-accent bg-accent-soft" : "border-border bg-surface"
          }`}
        >
          <input
            type="radio"
            name={name}
            checked={value === option.value}
            onChange={() => onChange(option.value)}
            className="size-4 accent-(--accent)"
          />
          <span className="flex flex-col">
            <span className="font-medium">{option.label}</span>
            {option.note ? <span className="text-xs text-muted">{option.note}</span> : null}
          </span>
        </label>
      ))}
    </div>
  );
}

/** A read-only summary shown on a wizard's last step. */
export function WizardReview({
  rows,
}: {
  rows: { label: string; value: string }[];
}): React.JSX.Element {
  return (
    <dl className="flex flex-col divide-y divide-border rounded-2xl border border-border bg-surface px-4">
      {rows.map((row) => (
        <div key={row.label} className="flex items-baseline justify-between gap-4 py-3 text-sm">
          <dt className="text-muted">{row.label}</dt>
          <dd className="text-right font-medium">{row.value}</dd>
        </div>
      ))}
    </dl>
  );
}
