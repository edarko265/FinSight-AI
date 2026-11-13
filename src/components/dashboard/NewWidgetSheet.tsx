"use client";

import { useEffect, useRef } from "react";
import { ChatPanel } from "@/components/chat/ChatPanel";
import type { ChartCard } from "@/lib/contracts/chart";
import { PROMPT_SUGGESTIONS } from "@/lib/demo/fixtures";

interface NewWidgetSheetProps {
  open: boolean;
  onClose: () => void;
  onAdd: (card: ChartCard) => void;
}

/** A bottom sheet where the assistant proposes a chart and the user decides whether to pin it. */
export function NewWidgetSheet({ open, onClose, onAdd }: NewWidgetSheetProps): React.JSX.Element {
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
      onClose={onClose}
      aria-labelledby="new-widget-title"
      className="m-0 mx-auto mt-auto h-[88dvh] w-full max-w-md flex-col rounded-t-3xl bg-background p-0 text-foreground backdrop:bg-black/50 open:flex"
    >
      <header className="flex items-center justify-between border-b border-border px-4 py-3">
        <h2 id="new-widget-title" className="text-base font-semibold">
          New widget
        </h2>
        <button
          type="button"
          onClick={onClose}
          className="rounded-full px-3 py-1.5 text-sm font-medium text-accent"
        >
          Close
        </button>
      </header>

      <ChatPanel
        intro="Tell me what you would like to see on your dashboard, and I will draw it."
        suggestions={PROMPT_SUGGESTIONS}
        placeholder="e.g. Show my restaurant spending"
        cardAction={(card) => (
          <button
            type="button"
            onClick={() => {
              onAdd(card);
              onClose();
            }}
            className="w-full rounded-full bg-primary px-5 py-3 text-sm font-semibold text-on-primary"
          >
            Add to dashboard
          </button>
        )}
      />
    </dialog>
  );
}
