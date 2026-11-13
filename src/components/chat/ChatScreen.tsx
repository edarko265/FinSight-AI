"use client";

import { useSearchParams } from "next/navigation";
import { useState } from "react";

import { ChatPanel } from "@/components/chat/ChatPanel";
import { usePreferences } from "@/components/providers/PreferencesProvider";
import { api } from "@/lib/api-client";
import type { ChartCard, DashboardWidget } from "@/lib/contracts/chart";

async function pinToDashboard(card: ChartCard, locale: string): Promise<void> {
  const { widgets } = await api<{ widgets: DashboardWidget[] }>(`/api/dashboard?locale=${locale}`);
  await api(`/api/dashboard?locale=${locale}`, {
    method: "PUT",
    json: { widgets: [{ id: `widget-${Date.now()}`, ...card }, ...widgets] },
  });
}

/** The coach tab. A question can be passed in the URL, which is how insights open the coach. */
export function ChatScreen(): React.JSX.Element {
  const { t, locale } = usePreferences();
  const question = useSearchParams().get("q") ?? undefined;
  const [added, setAdded] = useState<Set<string>>(new Set());

  async function addToDashboard(card: ChartCard): Promise<void> {
    await pinToDashboard(card, locale);
    setAdded((current) => new Set(current).add(card.title + card.summary));
  }

  return (
    <ChatPanel
      initialQuestion={question}
      cardAction={(card) => {
        const done = added.has(card.title + card.summary);
        return (
          <button
            type="button"
            disabled={done}
            onClick={() => void addToDashboard(card)}
            className="w-full rounded-full border border-border px-5 py-2.5 text-sm font-semibold text-accent disabled:opacity-60"
          >
            {t(done ? "chat.added" : "chat.addToDashboard")}
          </button>
        );
      }}
    />
  );
}
