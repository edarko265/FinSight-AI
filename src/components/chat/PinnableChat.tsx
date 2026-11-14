"use client";

import { useState } from "react";

import { ChatPanel, type ChatPanelProps } from "@/components/chat/ChatPanel";
import { usePreferences } from "@/components/providers/PreferencesProvider";
import { PendingLabel } from "@/components/ui/Spinner";
import { useAsyncAction } from "@/components/ui/useAsyncAction";
import { api } from "@/lib/api-client";
import type { DashboardPayload, WidgetQuery } from "@/lib/contracts/chart";

/** Sent after a chart is pinned, so a dashboard that is open behind the chat reloads. */
export const DASHBOARD_CHANGED = "finsight:dashboard-changed";

/** Adds a chart from the conversation to the view the user currently has open. */
async function pinToDashboard(query: WidgetQuery, locale: string): Promise<void> {
  const { cards: _cards, ...state } = await api<DashboardPayload>(
    `/api/dashboard?locale=${locale}`,
  );
  void _cards;
  await api(`/api/dashboard?locale=${locale}`, {
    method: "PUT",
    json: {
      ...state,
      views: state.views.map((view) =>
        view.id === state.activeId
          ? {
              ...view,
              widgets: [{ id: `widget-${Date.now()}`, query }, ...view.widgets].slice(0, 24),
            }
          : view,
      ),
    },
  });
  window.dispatchEvent(new Event(DASHBOARD_CHANGED));
}

/** One "Add to dashboard" button. Own component so each chart has its own pending state. */
function PinButton({
  query,
  done,
  onDone,
}: {
  query: WidgetQuery;
  done: boolean;
  onDone: () => void;
}): React.JSX.Element {
  const { t, locale } = usePreferences();
  const { run, pending } = useAsyncAction(() => pinToDashboard(query, locale), {
    successKey: "toast.added",
    errorKey: "common.saveFailed",
  });
  return (
    <button
      type="button"
      disabled={done}
      aria-disabled={pending || undefined}
      onClick={() => {
        if (pending) return;
        void run().then((result) => {
          if (result.ok) onDone();
        });
      }}
      className="w-full rounded-full border border-border px-5 py-2.5 text-sm font-semibold text-accent disabled:opacity-60 aria-disabled:opacity-60"
    >
      {pending ? (
        <PendingLabel>{t("common.saving")}</PendingLabel>
      ) : (
        t(done ? "chat.added" : "chat.addToDashboard")
      )}
    </button>
  );
}

/** The coach, with an "Add to dashboard" button under every chart it returns. */
export function PinnableChat(props: Omit<ChatPanelProps, "cardAction">): React.JSX.Element {
  const [added, setAdded] = useState<Set<string>>(new Set());

  return (
    <ChatPanel
      {...props}
      cardAction={(card, query) => {
        if (!query) return null;
        const key = card.title + card.summary;
        return (
          <PinButton
            query={query}
            done={added.has(key)}
            onDone={() => setAdded((current) => new Set(current).add(key))}
          />
        );
      }}
    />
  );
}
