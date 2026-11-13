import { ChartView } from "@/components/charts/ChartView";
import type { DashboardWidget } from "@/lib/contracts/chart";

interface WidgetCardProps {
  widget: DashboardWidget;
  onRemove: (id: string) => void;
}

export function WidgetCard({ widget, onRemove }: WidgetCardProps): React.JSX.Element {
  return (
    <article className="rounded-2xl border border-border bg-surface p-4">
      <header className="mb-1 flex items-start justify-between gap-3">
        <h2 className="text-base font-semibold">{widget.title}</h2>
        <button
          type="button"
          onClick={() => onRemove(widget.id)}
          aria-label={`Remove ${widget.title}`}
          className="-m-2 rounded-full p-2 text-muted"
        >
          <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
            <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
          </svg>
        </button>
      </header>
      <p className="mb-3 text-sm text-muted">{widget.summary}</p>
      <ChartView card={widget} />
      <p className="mt-3 text-xs text-muted">{widget.basis}</p>
    </article>
  );
}
