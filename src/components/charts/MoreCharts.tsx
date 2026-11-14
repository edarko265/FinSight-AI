"use client";

import {
  CHART_LABEL_SIZE,
  chartColor,
  chartInk,
  fitLabel,
} from "@/components/charts/chart-palette";
import { usePreferences } from "@/components/providers/PreferencesProvider";
import { RankedBars } from "@/components/charts/BarChart";
import { useChartLabels } from "@/components/charts/chart-labels";
import type { ChartPoint } from "@/lib/contracts/chart";
import { formatMoney } from "@/lib/i18n/config";

/**
 * The chart shapes beyond bars, line and donut. All of them draw the same
 * thing, a list of labelled amounts, so a customer can switch any widget to
 * any of them. Every mark carries its label and amount as a tooltip, and the
 * values list under the chart repeats the numbers for screen readers.
 */
type Props = { points: ChartPoint[] };

const positive = (points: ChartPoint[]): ChartPoint[] =>
  points.map((point) => ({ ...point, valueCents: Math.max(0, point.valueCents) }));
const sum = (points: ChartPoint[]): number =>
  points.reduce((total, point) => total + point.valueCents, 0);

function useTip(): (point: ChartPoint, total?: number) => string {
  const { locale } = usePreferences();
  return (point, total) =>
    `${point.label}: ${formatMoney(point.valueCents, locale)}${
      total && total > 0 ? ` · ${Math.round((point.valueCents / total) * 100)} %` : ""
    }`;
}

/** Rows: the readable choice when names are long. Each row keeps its series colour. */
export function HBarChart({ points }: Props): React.JSX.Element {
  return <RankedBars points={positive(points)} keyed />;
}

const W = 300;
const H = 150;

function coordinates(points: ChartPoint[], pad = 12): { x: number; y: number }[] {
  const max = Math.max(1, ...points.map((point) => point.valueCents));
  const min = Math.min(0, ...points.map((point) => point.valueCents));
  const span = Math.max(1, max - min);
  const step = points.length > 1 ? (W - pad * 2) / (points.length - 1) : 0;
  return points.map((point, index) => ({
    x: points.length > 1 ? pad + index * step : W / 2,
    y: pad + (1 - (point.valueCents - min) / span) * (H - pad * 2 - 16),
  }));
}

function AxisLabels({ points }: Props): React.JSX.Element | null {
  if (!useChartLabels()) return null;
  const shown = points.length <= 6 ? points.map((_, index) => index) : [0, points.length - 1];
  const at = coordinates(points);
  return (
    <>
      {shown.map((index) => (
        <text
          key={index}
          x={at[index]?.x ?? 0}
          y={H - 3}
          fontSize={CHART_LABEL_SIZE}
          fill="var(--muted)"
          textAnchor={index === 0 ? "start" : index === points.length - 1 ? "end" : "middle"}
        >
          {fitLabel(points[index]?.label ?? "", W / Math.max(points.length, 1))}
        </text>
      ))}
    </>
  );
}

/** A line with the area under it filled: good for a level over time. */
export function AreaChart({ points }: Props): React.JSX.Element {
  const labels = useChartLabels();
  const tip = useTip();
  const at = coordinates(points);
  const line = at.map((p, index) => `${index === 0 ? "M" : "L"}${p.x},${p.y}`).join(" ");
  const first = at[0];
  const last = at.at(-1);
  const base = labels ? H - 28 : H - 10;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" aria-hidden="true">
      {first && last ? (
        <path
          d={`${line} L${last.x},${base} L${first.x},${base} Z`}
          fill="var(--chart-1)"
          opacity={0.18}
        />
      ) : null}
      <path d={line} fill="none" stroke="var(--chart-1)" strokeWidth={2.5} className="fs-draw" />
      {at.map((p, index) => (
        <circle key={points[index]?.label} cx={p.x} cy={p.y} r={3.5} fill="var(--chart-1)">
          <title>{points[index] ? tip(points[index]) : ""}</title>
        </circle>
      ))}
      <AxisLabels points={points} />
    </svg>
  );
}

/** A stick with a dot on top: bars with less ink. */
export function LollipopChart({ points }: Props): React.JSX.Element {
  const labels = useChartLabels();
  const tip = useTip();
  const data = positive(points);
  const max = Math.max(1, ...data.map((point) => point.valueCents));
  const step = W / Math.max(1, data.length);
  const base = labels ? H - 22 : H - 8;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" aria-hidden="true">
      <line x1={0} x2={W} y1={base} y2={base} stroke="var(--border)" />
      {data.map((point, index) => {
        const x = step * index + step / 2;
        const y = base - (point.valueCents / max) * (base - 12);
        return (
          <g key={point.label}>
            <title>{tip(point)}</title>
            <line x1={x} x2={x} y1={base} y2={y} stroke={chartColor(index)} strokeWidth={3} />
            <circle cx={x} cy={y} r={6} fill={chartColor(index)} />
            {labels ? (
              <text
                x={x}
                y={H - 6}
                fontSize={CHART_LABEL_SIZE}
                textAnchor="middle"
                fill="var(--muted)"
              >
                {fitLabel(point.label, step)}
              </text>
            ) : null}
          </g>
        );
      })}
    </svg>
  );
}

function wedge(cx: number, cy: number, r: number, from: number, to: number): string {
  const point = (angle: number): string =>
    `${cx + r * Math.cos(angle - Math.PI / 2)},${cy + r * Math.sin(angle - Math.PI / 2)}`;
  return `M${cx},${cy} L${point(from)} A${r},${r} 0 ${to - from > Math.PI ? 1 : 0} 1 ${point(to)} Z`;
}

/** A filled pie. */
export function PieChart({ points }: Props): React.JSX.Element {
  const tip = useTip();
  const data = positive(points).filter((point) => point.valueCents > 0);
  const total = Math.max(1, sum(data));
  let angle = 0;
  return (
    <svg viewBox="0 0 140 140" className="fs-pop mx-auto h-auto w-40" aria-hidden="true">
      {data.length === 1 ? (
        <circle cx={70} cy={70} r={62} fill={chartColor(0)}>
          <title>{data[0] ? tip(data[0], total) : ""}</title>
        </circle>
      ) : (
        data.map((point, index) => {
          const from = angle;
          angle += (point.valueCents / total) * Math.PI * 2;
          return (
            <path
              key={point.label}
              d={wedge(70, 70, 62, from, angle)}
              fill={chartColor(index)}
              stroke="var(--surface)"
              strokeWidth={1.5}
            >
              <title>{tip(point, total)}</title>
            </path>
          );
        })
      )}
    </svg>
  );
}

/** One bar split into parts: the quickest read of shares of a whole. */
export function StackChart({ points }: Props): React.JSX.Element {
  const labels = useChartLabels();
  const tip = useTip();
  const data = positive(points).filter((point) => point.valueCents > 0);
  const total = Math.max(1, sum(data));
  return (
    <div className="flex h-8 overflow-hidden rounded-xl bg-border" aria-hidden="true">
      {data.map((point, index) => (
        <span
          key={point.label}
          title={tip(point, total)}
          className="fs-grow-x flex items-center justify-center overflow-hidden text-xs font-semibold"
          style={{
            width: `${(point.valueCents / total) * 100}%`,
            background: chartColor(index),
            color: chartInk(index),
          }}
        >
          {labels && point.valueCents / total >= 0.12
            ? `${Math.round((point.valueCents / total) * 100)}%`
            : ""}
        </span>
      ))}
    </div>
  );
}

interface Box {
  point: ChartPoint;
  index: number;
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Slice-and-dice layout: split the larger side each time, biggest first. */
function layout(
  points: { point: ChartPoint; index: number }[],
  x: number,
  y: number,
  w: number,
  h: number,
): Box[] {
  const [first, ...rest] = points;
  if (!first) return [];
  const total = points.reduce((all, item) => all + item.point.valueCents, 0);
  if (rest.length === 0 || total <= 0) return [{ ...first, x, y, w, h }];
  const share = first.point.valueCents / total;
  return w >= h
    ? [{ ...first, x, y, w: w * share, h }, ...layout(rest, x + w * share, y, w * (1 - share), h)]
    : [{ ...first, x, y, w, h: h * share }, ...layout(rest, x, y + h * share, w, h * (1 - share))];
}

/** Boxes sized by amount: shows at a glance what dominates. */
export function TreemapChart({ points }: Props): React.JSX.Element {
  const labels = useChartLabels();
  const tip = useTip();
  const data = positive(points)
    .map((point, index) => ({ point, index }))
    .filter((item) => item.point.valueCents > 0)
    .sort((a, b) => b.point.valueCents - a.point.valueCents);
  const total = Math.max(
    1,
    data.reduce((all, item) => all + item.point.valueCents, 0),
  );
  return (
    <svg viewBox={`0 0 ${W} 170`} className="h-auto w-full" aria-hidden="true">
      {layout(data, 0, 0, W, 170).map((box) => (
        <g key={box.point.label} className="fs-pop">
          <title>{tip(box.point, total)}</title>
          <rect
            x={box.x + 1.5}
            y={box.y + 1.5}
            width={Math.max(0, box.w - 3)}
            height={Math.max(0, box.h - 3)}
            rx={6}
            fill={chartColor(box.index)}
          />
          {labels && box.w > 62 && box.h > 30 ? (
            <>
              <text
                x={box.x + 9}
                y={box.y + 19}
                fontSize={CHART_LABEL_SIZE}
                fontWeight={600}
                fill={chartInk(box.index)}
              >
                {fitLabel(box.point.label, box.w - 8)}
              </text>
              <text
                x={box.x + 9}
                y={box.y + 33}
                fontSize={CHART_LABEL_SIZE}
                fill={chartInk(box.index)}
                opacity={0.85}
              >
                {Math.round((box.point.valueCents / total) * 100)} %
              </text>
            </>
          ) : null}
        </g>
      ))}
    </svg>
  );
}

/** Rings, one per item, each filled in proportion to the largest. */
export function RadialChart({ points }: Props): React.JSX.Element {
  const tip = useTip();
  const data = positive(points).slice(0, 6);
  const max = Math.max(1, ...data.map((point) => point.valueCents));
  const width = Math.min(12, 56 / Math.max(1, data.length));
  return (
    <svg viewBox="0 0 150 150" className="mx-auto h-auto w-44" aria-hidden="true">
      <g transform="rotate(-90 75 75)">
        {data.map((point, index) => {
          const r = 68 - index * (width + 2);
          const c = 2 * Math.PI * r;
          return (
            <g key={point.label}>
              <title>{tip(point)}</title>
              <circle
                cx={75}
                cy={75}
                r={r}
                fill="none"
                stroke="var(--border)"
                strokeWidth={width}
              />
              <circle
                cx={75}
                cy={75}
                r={r}
                fill="none"
                stroke={chartColor(index)}
                strokeWidth={width}
                strokeLinecap="round"
                strokeDasharray={`${(point.valueCents / max) * c * 0.75} ${c}`}
                className="fs-draw"
              />
            </g>
          );
        })}
      </g>
    </svg>
  );
}

/** A web with one spoke per item: the shape of the spending. Needs three or more items. */
export function RadarChart({ points }: Props): React.JSX.Element {
  const labels = useChartLabels();
  const tip = useTip();
  const data = positive(points).slice(0, 8);
  if (data.length < 3) return <HBarChart points={points} />;
  const max = Math.max(1, ...data.map((point) => point.valueCents));
  const at = (index: number, share: number): [number, number] => {
    const angle = (index / data.length) * Math.PI * 2 - Math.PI / 2;
    return [150 + Math.cos(angle) * 62 * share, 92 + Math.sin(angle) * 62 * share];
  };
  const ring = (share: number): string =>
    data.map((_, index) => at(index, share).join(",")).join(" ");
  return (
    <svg viewBox="0 0 300 184" className="mx-auto h-auto w-full max-w-80" aria-hidden="true">
      {[0.33, 0.66, 1].map((share) => (
        <polygon key={share} points={ring(share)} fill="none" stroke="var(--border)" />
      ))}
      {data.map((point, index) => {
        const [x, y] = at(index, 1);
        const [lx, ly] = at(index, 1.22);
        return (
          <g key={point.label}>
            <line x1={150} y1={92} x2={x} y2={y} stroke="var(--border)" />
            {labels ? (
              <text
                x={lx}
                y={ly + 3}
                fontSize={CHART_LABEL_SIZE}
                fill="var(--muted)"
                textAnchor={lx < 140 ? "end" : lx > 160 ? "start" : "middle"}
              >
                {fitLabel(point.label, lx < 140 ? lx : lx > 160 ? 300 - lx : 100)}
              </text>
            ) : null}
          </g>
        );
      })}
      <polygon
        points={data.map((point, index) => at(index, point.valueCents / max).join(",")).join(" ")}
        fill="var(--chart-1)"
        fillOpacity={0.25}
        stroke="var(--chart-1)"
        strokeWidth={2}
        className="fs-pop"
      />
      {data.map((point, index) => {
        const [x, y] = at(index, point.valueCents / max);
        return (
          <circle key={point.label} cx={x} cy={y} r={3.5} fill="var(--chart-1)">
            <title>{tip(point)}</title>
          </circle>
        );
      })}
    </svg>
  );
}

/** Each item starts where the last one ended, so the columns climb to the total. */
export function WaterfallChart({ points }: Props): React.JSX.Element {
  const labels = useChartLabels();
  const tip = useTip();
  const { t } = usePreferences();
  const data = positive(points).slice(0, 8);
  const total = Math.max(1, sum(data));
  const columns = [...data, { label: t("chart.total"), valueCents: total }];
  const step = W / columns.length;
  const base = labels ? H - 22 : H - 8;
  const scale = (base - 10) / total;
  let running = 0;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" aria-hidden="true">
      <line x1={0} x2={W} y1={base} y2={base} stroke="var(--border)" />
      {columns.map((point, index) => {
        const isTotal = index === columns.length - 1;
        const from = isTotal ? 0 : running;
        if (!isTotal) running += point.valueCents;
        const top = base - (from + point.valueCents) * scale;
        return (
          <g key={`${point.label}-${index}`}>
            <title>{tip(point, isTotal ? undefined : total)}</title>
            <rect
              x={index * step + 4}
              y={top}
              width={Math.max(2, step - 8)}
              height={Math.max(2, point.valueCents * scale)}
              rx={3}
              fill={isTotal ? "var(--chart-2)" : "var(--chart-1)"}
              opacity={isTotal ? 1 : 0.55 + (0.45 * index) / columns.length}
              className="fs-grow-y"
            />
            {labels ? (
              <text
                x={index * step + step / 2}
                y={H - 6}
                fontSize={CHART_LABEL_SIZE}
                textAnchor="middle"
                fill="var(--muted)"
              >
                {fitLabel(point.label, step)}
              </text>
            ) : null}
          </g>
        );
      })}
    </svg>
  );
}

/** Centred bars, largest first: what narrows to what. */
export function FunnelChart({ points }: Props): React.JSX.Element {
  const labels = useChartLabels();
  const tip = useTip();
  const data = positive(points)
    .map((point, index) => ({ point, index }))
    .sort((a, b) => b.point.valueCents - a.point.valueCents)
    .slice(0, 7);
  const max = Math.max(1, data[0]?.point.valueCents ?? 1);
  return (
    <ul className="flex flex-col items-center gap-1.5" aria-hidden="true">
      {data.map(({ point, index }) => (
        <li
          key={point.label}
          title={tip(point)}
          className="fs-grow-x flex h-7 items-center justify-center overflow-hidden rounded-lg px-2 text-xs font-semibold whitespace-nowrap"
          style={{
            width: `${Math.max(18, (point.valueCents / max) * 100)}%`,
            background: chartColor(index),
            color: chartInk(index),
          }}
        >
          {labels ? point.label : null}
        </li>
      ))}
    </ul>
  );
}

/** The numbers themselves, with a share bar in each row. */
export function TableChart({ points }: Props): React.JSX.Element {
  const { locale } = usePreferences();
  const total = Math.max(1, sum(positive(points)));
  return (
    <table className="w-full text-sm">
      <tbody>
        {points.map((point, index) => (
          <tr key={point.label} className="border-t border-border first:border-t-0">
            <td className="py-1.5 pr-2">
              <span className="flex items-center gap-2">
                <span
                  className="size-2.5 shrink-0 rounded-full"
                  style={{ background: chartColor(index) }}
                  aria-hidden="true"
                />
                {point.label}
              </span>
            </td>
            <td className="py-1.5 text-right font-medium tabular-nums">
              {formatMoney(point.valueCents, locale)}
            </td>
            <td className="w-14 py-1.5 pl-2 text-right text-xs text-muted tabular-nums">
              {Math.round((Math.max(0, point.valueCents) / total) * 100)} %
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** Big numbers: the first items as tiles. For a glance, not a comparison. */
export function StatChart({ points }: Props): React.JSX.Element {
  const { locale } = usePreferences();
  return (
    <ul className="grid grid-cols-2 gap-2">
      {points.slice(0, 4).map((point, index) => (
        <li
          key={point.label}
          className={`fs-pop rounded-xl border border-border p-3 ${
            points.length === 1 || (index === 0 && points.length === 3) ? "col-span-2" : ""
          }`}
        >
          <p className="truncate text-xs text-muted">{point.label}</p>
          <p className="mt-0.5 text-lg font-semibold tabular-nums">
            {formatMoney(point.valueCents, locale)}
          </p>
        </li>
      ))}
    </ul>
  );
}
