"use client";

import { useId, useState } from "react";

import { usePreferences } from "@/components/providers/PreferencesProvider";
import { InfoIcon } from "@/components/ui/icons";

interface InfoTipProps {
  /** The explanation, hidden until the icon is pressed. */
  children: React.ReactNode;
  /** What sits in front of the icon on the same line, usually a heading. */
  lead?: React.ReactNode;
  className?: string;
}

/**
 * Keeps background explanation out of the way: an info icon that opens the text
 * right beneath it. A button, so it works by touch and keyboard, and Escape closes it.
 */
export function InfoTip({ children, lead, className = "" }: InfoTipProps): React.JSX.Element {
  const { t } = usePreferences();
  const [open, setOpen] = useState(false);
  const id = useId();
  const label = t(open ? "info.hide" : "info.show");

  return (
    <div className={`flex flex-wrap items-center gap-x-1 ${className}`}>
      {lead}
      <button
        type="button"
        aria-expanded={open}
        aria-controls={id}
        aria-label={label}
        title={label}
        onClick={() => setOpen((value) => !value)}
        onKeyDown={(event) => {
          if (event.key !== "Escape" || !open) return;
          // Closes only the tip, not the sheet or story around it.
          event.preventDefault();
          event.stopPropagation();
          setOpen(false);
        }}
        className={`-ml-1 flex size-8 shrink-0 items-center justify-center rounded-full outline-none hover:bg-background focus-visible:ring-2 focus-visible:ring-accent ${
          open ? "text-accent" : "text-muted"
        }`}
      >
        <InfoIcon className="size-5" />
      </button>
      {open ? (
        <p id={id} className="basis-full text-sm text-muted">
          {children}
        </p>
      ) : null}
    </div>
  );
}
