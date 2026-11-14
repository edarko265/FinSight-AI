import "server-only";

import { z } from "zod";

import type { SessionContext } from "@/lib/coach/context";
import { runQuery } from "@/lib/coach/registry";
import {
  CHART_STYLES,
  VIEW_PERIODS,
  type DashboardPayload,
  type DashboardState,
  type DashboardView,
  type DashboardWidget,
} from "@/lib/contracts/chart";
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
  period: z.enum(VIEW_PERIODS),
  widgets: z.array(z.object({ id: z.string().min(1).max(60), query })).max(16),
});
export const dashboardStateSchema = z.object({
  activeId: z.string().max(60),
  views: z.array(view).min(1).max(12),
});

const w = (
  id: string,
  tool: string,
  input: Record<string, unknown> = {},
): DashboardView["widgets"][number] => ({
  id,
  query: { tool, input },
});

export function defaultState(): DashboardState {
  return {
    activeId: "overview",
    views: [
      {
        id: "overview",
        preset: "overview",
        name: "",
        period: "last_month",
        widgets: [
          w("flow", "flow"),
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

export async function saveDashboard(
  ctx: SessionContext,
  state: DashboardState,
): Promise<DashboardPayload> {
  const activeId = state.views.some((item) => item.id === state.activeId)
    ? state.activeId
    : (state.views[0]?.id ?? "");
  const next = { ...state, activeId };
  await writeState(ctx.customerRef, STATE_KIND, next);
  return render(ctx, next);
}

function render(ctx: SessionContext, state: DashboardState): DashboardPayload {
  const active = state.views.find((item) => item.id === state.activeId) ?? state.views[0];
  const cards: DashboardWidget[] = [];
  for (const widget of active?.widgets ?? []) {
    const result = runQuery(ctx, widget.query, active?.period);
    if (result?.card) cards.push({ id: widget.id, ...result.card });
  }
  return { ...state, activeId: active?.id ?? state.activeId, cards };
}
