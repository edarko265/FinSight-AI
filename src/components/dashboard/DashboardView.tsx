"use client";

import { useState } from "react";
import { NewWidgetSheet } from "@/components/dashboard/NewWidgetSheet";
import { WidgetCard } from "@/components/dashboard/WidgetCard";
import type { ChartCard, DashboardWidget } from "@/lib/contracts/chart";
import { DEMO_ACCOUNT, INITIAL_WIDGETS } from "@/lib/demo/fixtures";
import { formatEur } from "@/lib/money";

export function DashboardView(): React.JSX.Element {
  const [widgets, setWidgets] = useState<DashboardWidget[]>(INITIAL_WIDGETS);
  const [sheetOpen, setSheetOpen] = useState(false);

  function addWidget(card: ChartCard): void {
    setWidgets((current) => [{ id: `widget-${Date.now()}`, ...card }, ...current]);
  }

  function removeWidget(id: string): void {
    setWidgets((current) => current.filter((widget) => widget.id !== id));
  }

  return (
    <div className="flex flex-col gap-4 px-4 py-4">
      <section className="rounded-2xl bg-brand p-5 text-on-brand">
        <p className="text-sm opacity-80">Balance</p>
        <p className="mt-1 text-3xl font-semibold tabular-nums">
          {formatEur(DEMO_ACCOUNT.balanceCents)}
        </p>
        <p className="mt-1 text-xs opacity-70">As of {DEMO_ACCOUNT.asOf}</p>
      </section>

      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">My dashboard</h1>
        <button
          type="button"
          onClick={() => setSheetOpen(true)}
          className="rounded-full bg-primary px-4 py-2.5 text-sm font-semibold text-on-primary"
        >
          + New widget
        </button>
      </div>

      {widgets.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted">
          Your dashboard is empty. Add a widget and describe what you would like to see.
        </p>
      ) : (
        <div className="flex flex-col gap-4">
          {widgets.map((widget) => (
            <WidgetCard key={widget.id} widget={widget} onRemove={removeWidget} />
          ))}
        </div>
      )}

      <NewWidgetSheet open={sheetOpen} onClose={() => setSheetOpen(false)} onAdd={addWidget} />
    </div>
  );
}
