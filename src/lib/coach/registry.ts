import { z } from "zod";

import { mortgageTool, recommendTool, saveTool } from "@/lib/coach/advice";
import {
  balanceTool,
  basketsTool,
  fallbackResult,
  flowTool,
  peersTool,
  PERIOD_KEYS,
  accountsTool,
  planTool,
  subscriptionsTool,
  profileTool,
  recurringTool,
  safeToSpendTool,
  spendingTool,
  TARGET_KEYS,
  trendTool,
  whatIfTool,
  type CoachContext,
  type PeriodKey,
  type ToolResult,
} from "@/lib/coach/tools";
import {
  CUSTOM_PERIOD,
  type ChartStyle,
  type PresetPeriod,
  type ViewPeriod,
  type WidgetQuery,
} from "@/lib/contracts/chart";

/**
 * Every calculation the coach can run, with a validated input schema. Chat,
 * dashboard widgets, the language model and voice all go through runTool, so a
 * saved widget is just a stored { tool, input } that is re-run when shown.
 */
const target = z.enum(TARGET_KEYS);
const period = z.union([
  z.enum(PERIOD_KEYS),
  z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
  z.string().regex(CUSTOM_PERIOD),
]);
const cents = z.number().int().min(0).max(100_000_000);

const asPeriod = (value: string | undefined): PeriodKey | undefined =>
  value as PeriodKey | undefined;

export const TOOL_SCHEMAS = {
  spending: z.object({ target: target.optional(), period: period.optional() }),
  trend: z.object({
    target: target.optional(),
    months: z.number().int().min(3).max(12).optional(),
  }),
  baskets: z.object({ period: period.optional() }),
  flow: z.object({ period: period.optional() }),
  balance: z.object({}),
  safe_to_spend: z.object({
    horizonDays: z.number().int().min(1).max(31).optional(),
    protectedCents: cents.optional(),
    otherOutflowsCents: cents.optional(),
    includeExpectedIncome: z.boolean().optional(),
  }),
  what_if: z.object({ target, percent: z.number().min(0).max(100), period: period.optional() }),
  peers: z.object({ target: target.optional() }),
  profile: z.object({}),
  recurring: z.object({}),
  recommend: z.object({}),
  plan: z.object({}),
  subscriptions: z.object({}),
  accounts: z.object({}),
  safe_to_save: z.object({ amountCents: cents.optional() }),
  mortgage: z.object({}),
} as const;

export type ToolName = keyof typeof TOOL_SCHEMAS;
export type ToolInput<T extends ToolName> = z.infer<(typeof TOOL_SCHEMAS)[T]>;

function isToolName(value: string): value is ToolName {
  return value in TOOL_SCHEMAS;
}

const MONTHS_FOR_PERIOD: Partial<Record<PresetPeriod, number>> = {
  last_3_months: 3,
  last_6_months: 6,
  last_12_months: 12,
};

function execute<T extends ToolName>(ctx: CoachContext, tool: T, raw: unknown): ToolResult {
  switch (tool) {
    case "spending": {
      const input = TOOL_SCHEMAS.spending.parse(raw);
      return spendingTool(ctx, { ...input, period: asPeriod(input.period) });
    }
    case "trend":
      return trendTool(ctx, TOOL_SCHEMAS.trend.parse(raw));
    case "baskets":
      return basketsTool(ctx, { period: asPeriod(TOOL_SCHEMAS.baskets.parse(raw).period) });
    case "flow":
      return flowTool(ctx, { period: asPeriod(TOOL_SCHEMAS.flow.parse(raw).period) });
    case "balance":
      return balanceTool(ctx);
    case "safe_to_spend":
      return safeToSpendTool(ctx, TOOL_SCHEMAS.safe_to_spend.parse(raw));
    case "what_if": {
      const input = TOOL_SCHEMAS.what_if.parse(raw);
      return whatIfTool(ctx, { ...input, period: asPeriod(input.period) });
    }
    case "peers":
      return peersTool(ctx, TOOL_SCHEMAS.peers.parse(raw));
    case "profile":
      return profileTool(ctx);
    case "recurring":
      return recurringTool(ctx);
    case "recommend":
      return recommendTool(ctx);
    case "plan":
      return planTool(ctx);
    case "subscriptions":
      return subscriptionsTool(ctx);
    case "accounts":
      return accountsTool(ctx);
    case "safe_to_save":
      return saveTool(ctx, TOOL_SCHEMAS.safe_to_save.parse(raw));
    case "mortgage":
      return mortgageTool(ctx);
    default:
      return fallbackResult(ctx);
  }
}

/**
 * Redraws a result in the chart type the user asked for. Every chart is a list
 * of labelled amounts, so any of them can be shown as bars, a line or a pie.
 */
export function applyChart(result: ToolResult, chart: ChartStyle | undefined): ToolResult {
  if (!chart || !result.card) return result;
  return {
    ...result,
    card: { ...result.card, chart: { kind: chart, points: result.card.chart.points } },
    query: result.query ? { ...result.query, chart } : undefined,
  };
}

/** Runs one tool with validated input and records the call on the result. */
export function runTool<T extends ToolName>(
  ctx: CoachContext,
  tool: T,
  input: ToolInput<T>,
  chart?: ChartStyle,
): ToolResult {
  const result = execute(ctx, tool, input);
  return applyChart({ ...result, query: { tool, input: input as Record<string, unknown> } }, chart);
}

/**
 * Runs a stored widget. Returns null if the stored call is no longer valid.
 * A dashboard view's period replaces the widget's own period where it has one.
 */
export function runQuery(
  ctx: CoachContext,
  query: WidgetQuery,
  viewPeriod?: ViewPeriod,
): ToolResult | null {
  if (!isToolName(query.tool)) return null;
  const input: Record<string, unknown> = { ...query.input };
  if (viewPeriod) {
    if (
      query.tool === "spending" ||
      query.tool === "baskets" ||
      query.tool === "flow" ||
      query.tool === "what_if"
    ) {
      input.period = viewPeriod;
    }
    const custom = CUSTOM_PERIOD.exec(viewPeriod);
    // For a month-by-month trend, a custom range becomes the nearest whole number of months.
    const months =
      custom?.[1] && custom[2]
        ? Math.min(
            12,
            Math.max(
              3,
              Math.round((Date.parse(custom[2]) - Date.parse(custom[1])) / (30.4 * 86_400_000)),
            ),
          )
        : MONTHS_FOR_PERIOD[viewPeriod as PresetPeriod];
    if (query.tool === "trend" && months) input.months = months;
  }
  const parsed = TOOL_SCHEMAS[query.tool].safeParse(input);
  if (!parsed.success) return null;
  const result = execute(ctx, query.tool, parsed.data);
  return applyChart({ ...result, query: { tool: query.tool, input: query.input } }, query.chart);
}
