import "server-only";

import { z } from "zod";

import type { SessionContext } from "@/lib/coach/context";
import { runQuery } from "@/lib/coach/registry";
import {
  CHART_STYLES,
  CUSTOM_PERIOD,
  isActionWidget,
  VIEW_PERIODS,
  WIDGET_SIZES,
  type DashboardPayload,
  type DashboardState,
  type DashboardView,
  type DashboardWidget,
} from "@/lib/contracts/chart";
import { addToTrash, removedFromDashboard, type TrashItem } from "@/lib/coach/trash";
import { readState, writeState } from "@/lib/data/repository";

/** Saved dashboard setups. Widgets are stored as questions and recalculated every time they are shown. */
const STATE_KIND = "views";

const query = z.object({
  tool: z.string().max(40),
  input: z.record(z.string().max(40), z.unknown()),
  chart: z.enum(CHART_STYLES).optional(),
});
const view = z.object({
  id: z.string().min(1).max(60),
  preset: z.enum(["overview", "baskets", "everyday"]).optional(),
  name: z.string().trim().max(40),
  period: z.union([z.enum(VIEW_PERIODS), z.string().regex(CUSTOM_PERIOD)]),
  widgets: z
    .array(
      z.object({
        id: z.string().min(1).max(60),
        query,
        size: z.enum(WIDGET_SIZES).optional(),
        collapsed: z.boolean().optional(),
      }),
    )
    .max(24),
});
export const dashboardStateSchema = z
  .object({
    activeId: z.string().max(60),
    views: z.array(view).min(1).max(12),
  })
  // Two views, or two widgets in a view, may not share an identifier.
  .refine(
    (state) =>
      new Set(state.views.map((item) => item.id)).size === state.views.length &&
      state.views.every(
        (item) => new Set(item.widgets.map((widget) => widget.id)).size === item.widgets.length,
      ),
  );

const w = (
  id: string,
  tool: string,
  input: Record<string, unknown> = {},
): DashboardView["widgets"][number] => ({
  id,
  query: { tool, input },
});

function defaultState(): DashboardState {
  return {
    activeId: "overview",
    views: [
      {
        id: "overview",
        preset: "overview",
        name: "",
        period: "last_month",
        widgets: [
          { ...w("ask", "ask"), size: "wide" },
          w("call", "call"),
          w("afford", "afford"),
          { ...w("flow", "flow"), size: "wide" },
          w("spending", "spending"),
          w("safe", "safe_to_spend"),
          w("trend", "trend"),
        ],
      },
      {
        id: "baskets",
        preset: "baskets",
        name: "",
        period: "last_3_months",
        widgets: [w("baskets", "baskets"), w("recurring", "recurring"), w("profile", "profile")],
      },
      {
        id: "everyday",
        preset: "everyday",
        name: "",
        period: "last_month",
        widgets: [
          w("restaurants", "spending", { target: "Restaurants" }),
          w("cafes", "spending", { target: "cafes" }),
          w("whatif", "what_if", { target: "Restaurants", percent: 20 }),
          w("peers", "peers", { target: "Restaurants" }),
        ],
      },
    ],
  };
}

export async function loadDashboard(ctx: SessionContext): Promise<DashboardPayload> {
  const saved = dashboardStateSchema.safeParse(await readState(ctx.customerRef, STATE_KIND));
  return render(ctx, saved.success ? saved.data : defaultState());
}

async function currentState(ctx: SessionContext): Promise<DashboardState> {
  const saved = dashboardStateSchema.safeParse(await readState(ctx.customerRef, STATE_KIND));
  return saved.success ? saved.data : defaultState();
}

/** Saves the views. Any view or widget that the save removes goes to the recycle bin. */
export async function saveDashboard(
  ctx: SessionContext,
  state: DashboardState,
): Promise<DashboardPayload> {
  const activeId = state.views.some((item) => item.id === state.activeId)
    ? state.activeId
    : (state.views[0]?.id ?? "");
  const next = { ...state, activeId };
  await addToTrash(ctx.customerRef, removedFromDashboard(await currentState(ctx), next));
  await writeState(ctx.customerRef, STATE_KIND, next);
  return render(ctx, next);
}

/** Puts a deleted view or widget back. A widget returns to its view, or to the open view if that is gone. */
export async function restoreToDashboard(
  ctx: SessionContext,
  item: Extract<TrashItem, { kind: "view" | "widget" }>,
): Promise<void> {
  const state = await currentState(ctx);
  if (item.kind === "view") {
    const id = state.views.some((view) => view.id === item.item.id)
      ? `view-${crypto.randomUUID()}`
      : item.item.id;
    await writeState(ctx.customerRef, STATE_KIND, {
      ...state,
      views: [...state.views, { ...item.item, id }].slice(0, 12),
    });
    return;
  }
  const targetId = state.views.some((view) => view.id === item.viewId)
    ? item.viewId
    : state.activeId;
  await writeState(ctx.customerRef, STATE_KIND, {
    ...state,
    views: state.views.map((view) =>
      view.id === targetId ? { ...view, widgets: [item.item, ...view.widgets].slice(0, 24) } : view,
    ),
  });
}

function render(ctx: SessionContext, state: DashboardState): DashboardPayload {
  const active = state.views.find((item) => item.id === state.activeId) ?? state.views[0];
  const cards: DashboardWidget[] = [];
  for (const widget of active?.widgets ?? []) {
    const layout = {
      id: widget.id,
      size: widget.size ?? "small",
      collapsed: widget.collapsed ?? false,
    };
    // Shortcuts and live panels have nothing to calculate here; the app draws them.
    if (isActionWidget(widget.query.tool)) {
      cards.push({ ...layout, action: widget.query.tool });
      continue;
    }
    const result = runQuery(ctx, widget.query, active?.period);
    if (result?.card) cards.push({ ...layout, card: result.card });
  }
  return { ...state, activeId: active?.id ?? state.activeId, cards };
}
