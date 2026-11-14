"use client";

import { useState } from "react";

import { ChartPlot } from "@/components/charts/ChartView";
import { usePreferences } from "@/components/providers/PreferencesProvider";
import { Wizard, WizardChoices, WizardReview } from "@/components/ui/Wizard";
import {
  ACTION_WIDGETS,
  CHART_STYLES,
  type ActionWidget,
  type ChartStyle,
  type SavedWidget,
  type WidgetSize,
} from "@/lib/contracts/chart";
import type { MessageKey } from "@/lib/i18n/translate";

/** Calculations that can be pinned. `target` marks the ones that can be narrowed to one kind of spending. */
const CHARTS = [
  { tool: "spending", target: "optional" },
  { tool: "trend", target: "optional" },
  { tool: "baskets", target: "none" },
  { tool: "flow", target: "none" },
  { tool: "plan", target: "none" },
  { tool: "balance", target: "none" },
  { tool: "safe_to_spend", target: "none" },
  { tool: "recurring", target: "none" },
  { tool: "profile", target: "none" },
  { tool: "peers", target: "optional" },
  { tool: "what_if", target: "required" },
  { tool: "recommend", target: "none" },
  { tool: "subscriptions", target: "none" },
  { tool: "accounts", target: "none" },
  { tool: "safe_to_save", target: "none" },
] as const;
type ChartTool = (typeof CHARTS)[number]["tool"];

const TARGETS = [
  "Housing",
  "Utilities",
  "Health",
  "Home & Tech",
  "Groceries",
  "Transportation",
  "Restaurants",
  "Entertainment",
  "Lifestyle",
  "Travel",
  "taxi",
  "cafes",
] as const;
type Target = (typeof TARGETS)[number] | "all";

type Family = "chart" | "action";
type ChartChoice = ChartStyle | "auto";

/** A small picture of each chart type, for the gallery. */
const GLYPHS: Record<ChartChoice, React.JSX.Element> = {
  auto: <path d="M12 3l2.2 5.6L20 9.3l-4.4 3.9L17 19l-5-3-5 3 1.4-5.8L4 9.3l5.8-.7z" />,
  bar: <path d="M5 20V11M10 20V5M15 20v-7M20 20V8" strokeWidth={3} />,
  hbar: <path d="M4 6h14M4 12h9M4 18h16" strokeWidth={3} />,
  line: <path d="M3 17l5-6 4 3 8-9" />,
  area: <path d="M3 20v-4l5-6 4 3 8-8v15z" fill="currentColor" fillOpacity={0.3} />,
  donut: (
    <>
      <circle cx={12} cy={12} r={7} strokeWidth={4} />
      <path d="M12 5a7 7 0 0 1 7 7" strokeWidth={4} stroke="var(--chart-2)" />
    </>
  ),
  pie: (
    <>
      <circle cx={12} cy={12} r={9} fill="currentColor" fillOpacity={0.25} />
      <path d="M12 12V3a9 9 0 0 1 9 9z" fill="currentColor" />
    </>
  ),
  stack: (
    <>
      <rect x={3} y={9} width={18} height={6} rx={2} />
      <path d="M10 9v6M16 9v6" />
    </>
  ),
  treemap: (
    <>
      <rect x={3} y={4} width={18} height={16} rx={2} />
      <path d="M13 4v16M13 12h8M3 13h10" />
    </>
  ),
  radial: (
    <>
      <path d="M12 3a9 9 0 1 0 9 9" />
      <path d="M12 7a5 5 0 1 0 5 5" />
    </>
  ),
  radar: (
    <>
      <path d="M12 3l8.5 6.2-3.2 10H6.7l-3.2-10z" />
      <path d="M12 8l4 3-1.5 4.5h-5L8 11z" fill="currentColor" fillOpacity={0.3} />
    </>
  ),
  waterfall: <path d="M5 20v-5M10 15v-5M15 10V5M20 20V5" strokeWidth={3} />,
  lollipop: (
    <>
      <path d="M6 20v-8M12 20V8M18 20v-5" />
      <circle cx={6} cy={10} r={2} fill="currentColor" />
      <circle cx={12} cy={6} r={2} fill="currentColor" />
      <circle cx={18} cy={13} r={2} fill="currentColor" />
    </>
  ),
  funnel: <path d="M3 6h18M6 12h12M9 18h6" strokeWidth={3} />,
  table: (
    <>
      <rect x={3} y={4} width={18} height={16} rx={2} />
      <path d="M3 10h18M3 15h18M12 4v16" />
    </>
  ),
  stat: (
    <>
      <rect x={3} y={5} width={8} height={6} rx={1.5} />
      <rect x={13} y={5} width={8} height={6} rx={1.5} />
      <rect x={3} y={13} width={18} height={6} rx={1.5} />
    </>
  ),
};

const SAMPLE_VALUES = [80_100, 38_600, 28_900, 22_200, 14_500];
const SAMPLE_LABELS = ["Housing", "Groceries", "Lifestyle", "Restaurants", "Travel"] as const;

interface AddWidgetWizardProps {
  open: boolean;
  onClose: () => void;
  onAdd: (widget: Omit<SavedWidget, "id">) => void;
  /** Opens the conversation where the customer describes the widget in their own words. */
  onDescribe: () => void;
}

/**
 * Adding a widget: choose what it shows, how it is drawn and how wide it is,
 * with a live preview of the chart type. Or skip all of that and describe it.
 */
export function AddWidgetWizard({
  open,
  onClose,
  onAdd,
  onDescribe,
}: AddWidgetWizardProps): React.JSX.Element {
  const { t } = usePreferences();
  const [family, setFamily] = useState<Family>("chart");
  const [tool, setTool] = useState<ChartTool>("spending");
  const [action, setAction] = useState<ActionWidget>("ask");
  const [target, setTarget] = useState<Target>("all");
  const [chart, setChart] = useState<ChartChoice>("auto");
  const [size, setSize] = useState<WidgetSize>("small");

  const spec = CHARTS.find((item) => item.tool === tool);
  const needsTarget = family === "chart" && spec?.target !== "none";
  const realTarget =
    target === "all" ? (spec?.target === "required" ? "Restaurants" : null) : target;
  const label = (key: string): string => t(`cat.${key}` as MessageKey);
  const what =
    family === "chart"
      ? `${t(`admin.topic.${tool}` as MessageKey)}${realTarget ? ` · ${label(realTarget)}` : ""}`
      : t(`widget.${action}.title` as MessageKey);

  function reset(): void {
    setFamily("chart");
    setTool("spending");
    setAction("ask");
    setTarget("all");
    setChart("auto");
    setSize("small");
  }

  function finish(): void {
    if (family === "action") {
      onAdd({ query: { tool: action, input: {} }, size });
    } else {
      const input: Record<string, unknown> = realTarget ? { target: realTarget } : {};
      if (tool === "what_if") input.percent = 20;
      onAdd({ query: { tool, input, chart: chart === "auto" ? undefined : chart }, size });
    }
    reset();
    onClose();
  }

  return (
    <Wizard
      open={open}
      title={t("dashboard.newWidget")}
      finishLabel={t("chat.addToDashboard")}
      onClose={() => {
        reset();
        onClose();
      }}
      onFinish={finish}
      steps={[
        {
          title: t("widget.add.kind"),
          hint: t("widget.add.kindHint"),
          valid: true,
          content: (
            <>
              <WizardChoices
                name="widget-family"
                value={family}
                onChange={setFamily}
                options={[
                  {
                    value: "chart",
                    label: t("widget.add.chart"),
                    note: t("widget.add.chart.note"),
                  },
                  {
                    value: "action",
                    label: t("widget.add.action"),
                    note: t("widget.add.action.note"),
                  },
                ]}
              />
              <button
                type="button"
                onClick={() => {
                  reset();
                  onClose();
                  onDescribe();
                }}
                className="rounded-2xl border border-dashed border-accent px-4 py-3 text-left text-sm"
              >
                <span className="block font-semibold text-accent">{t("widget.add.describe")}</span>
                <span className="block text-muted">{t("widget.add.describe.note")}</span>
              </button>
            </>
          ),
        },
        {
          title: t("widget.add.what"),
          hint: t(family === "chart" ? "widget.add.whatHint" : "widget.add.actionHint"),
          valid: true,
          content:
            family === "chart" ? (
              <WizardChoices
                name="widget-tool"
                value={tool}
                onChange={(value) => {
                  setTool(value);
                  setTarget("all");
                }}
                options={CHARTS.map((item) => ({
                  value: item.tool,
                  label: t(`admin.topic.${item.tool}` as MessageKey),
                  note: t(`widget.chart.${item.tool}` as MessageKey),
                }))}
              />
            ) : (
              <WizardChoices
                name="widget-action"
                value={action}
                onChange={setAction}
                options={ACTION_WIDGETS.map((item) => ({
                  value: item,
                  label: t(`widget.${item}.title` as MessageKey),
                  note: t(`widget.${item}.note` as MessageKey),
                }))}
              />
            ),
        },
        ...(needsTarget
          ? [
              {
                title: t("widget.add.target"),
                hint: t("widget.add.targetHint"),
                valid: true,
                content: (
                  <label className="flex flex-col gap-1.5 text-sm font-medium">
                    {t("widget.add.target")}
                    <select
                      value={
                        target === "all" && spec?.target === "required" ? "Restaurants" : target
                      }
                      onChange={(event) => setTarget(event.target.value as Target)}
                      className="rounded-xl border border-border bg-surface px-4 py-3 text-base font-normal"
                    >
                      {spec?.target === "optional" ? (
                        <option value="all">{t("widget.add.target.all")}</option>
                      ) : null}
                      {TARGETS.map((key) => (
                        <option key={key} value={key}>
                          {label(key)}
                        </option>
                      ))}
                    </select>
                  </label>
                ),
              },
            ]
          : []),
        ...(family === "chart"
          ? [
              {
                title: t("chart.type"),
                hint: t("widget.add.chartHint"),
                valid: true,
                content: (
                  <div className="flex flex-col gap-3">
                    <div
                      role="radiogroup"
                      aria-label={t("chart.type")}
                      className="grid grid-cols-4 gap-2"
                    >
                      {(["auto", ...CHART_STYLES] as ChartChoice[]).map((style) => (
                        <button
                          key={style}
                          type="button"
                          role="radio"
                          aria-checked={chart === style}
                          onClick={() => setChart(style)}
                          className={`flex flex-col items-center gap-1 rounded-xl border px-1 py-2 text-xs font-medium outline-none focus-visible:ring-2 focus-visible:ring-accent ${
                            chart === style
                              ? "border-accent bg-accent-soft text-accent"
                              : "border-border text-muted"
                          }`}
                        >
                          <svg
                            viewBox="0 0 24 24"
                            className="size-6"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth={2}
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            aria-hidden="true"
                          >
                            {GLYPHS[style]}
                          </svg>
                          <span className="max-w-full truncate">
                            {t(`chart.type.${style}` as MessageKey)}
                          </span>
                        </button>
                      ))}
                    </div>
                    {chart === "auto" ? (
                      <p className="rounded-xl bg-accent-soft px-3 py-2 text-sm">
                        {t("widget.add.auto")}
                      </p>
                    ) : (
                      <figure className="rounded-2xl border border-border p-3">
                        <ChartPlot
                          chart={{
                            kind: chart,
                            points: SAMPLE_LABELS.map((key, index) => ({
                              label: label(key),
                              valueCents: SAMPLE_VALUES[index] ?? 0,
                            })),
                          }}
                        />
                        <figcaption className="mt-2 text-sm text-muted">
                          {t("widget.add.preview")}
                        </figcaption>
                      </figure>
                    )}
                  </div>
                ),
              },
            ]
          : []),
        {
          title: t("widget.add.size"),
          hint: t("widget.add.sizeHint"),
          valid: true,
          content: (
            <WizardChoices
              name="widget-size"
              value={size}
              onChange={setSize}
              options={[
                {
                  value: "small",
                  label: t("widget.size.small"),
                  note: t("widget.size.small.note"),
                },
                { value: "wide", label: t("widget.size.wide"), note: t("widget.size.wide.note") },
              ]}
            />
          ),
        },
        {
          title: t("wizard.review"),
          hint: t("wizard.reviewHint"),
          valid: true,
          content: (
            <WizardReview
              rows={[
                { label: t("widget.add.what"), value: what },
                ...(family === "chart"
                  ? [{ label: t("chart.type"), value: t(`chart.type.${chart}` as MessageKey) }]
                  : []),
                { label: t("widget.add.size"), value: t(`widget.size.${size}` as MessageKey) },
              ]}
            />
          ),
        },
      ]}
    />
  );
}
