"use client";

import { useRef } from "react";
import { ChatPanel } from "@/components/chat/ChatPanel";
import type { WidgetQuery } from "@/lib/contracts/chart";
import { usePreferences } from "@/components/providers/PreferencesProvider";
import {
  TAB_SHEET_MAX_H,
  TAB_SHEET_POSITION,
  TabSheetBackdrop,
  useSheetDialog,
} from "@/components/ui/TabSheet";

interface NewWidgetSheetProps {
  open: boolean;
  onClose: () => void;
  onAdd: (query: WidgetQuery) => void;
}

/** A bottom sheet where the assistant proposes a chart and the user decides whether to pin it. */
export function NewWidgetSheet({ open, onClose, onAdd }: NewWidgetSheetProps): React.JSX.Element {
  const { t } = usePreferences();
  const dialogRef = useRef<HTMLDialogElement>(null);

  const dismiss = useSheetDialog(dialogRef, open, () => onClose());

  return (
    <>
      {open ? <TabSheetBackdrop onClick={() => dismiss("backdrop")} /> : null}
      <dialog
        ref={dialogRef}
        aria-labelledby="new-widget-title"
        className={`${TAB_SHEET_POSITION} ${TAB_SHEET_MAX_H} h-[88dvh] flex-col bg-background p-0 text-foreground open:flex`}
      >
        <header className="flex items-center justify-between border-b border-border px-4 py-3">
          <h2 id="new-widget-title" className="text-base font-semibold">
            {t("dashboard.newWidget")}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full px-3 py-1.5 text-sm font-medium text-accent"
          >
            {t("evidence.close")}
          </button>
        </header>

        {open ? (
          <ChatPanel
            intro={t("dashboard.widgetPrompt")}
            placeholder={t("dashboard.widgetExample")}
            cardAction={(_card, query) =>
              query ? (
                <button
                  type="button"
                  onClick={() => {
                    onAdd(query);
                    onClose();
                  }}
                  className="w-full rounded-full bg-primary px-5 py-3 text-sm font-semibold text-on-primary"
                >
                  {t("chat.addToDashboard")}
                </button>
              ) : null
            }
          />
        ) : null}
      </dialog>
    </>
  );
}
