import { z } from "zod";

import { getSessionContext, unauthorized } from "@/lib/coach/context";
import { basketsTool, safeToSpendTool, spendingTool, trendTool } from "@/lib/coach/tools";
import type { DashboardWidget } from "@/lib/contracts/chart";
import { readState, writeState } from "@/lib/data/repository";

const point = z.object({ label: z.string().max(80), valueCents: z.number().int() });
const widget = z.object({
  id: z.string().max(80),
  title: z.string().max(200),
  summary: z.string().max(1000),
  basis: z.string().max(600),
  chart: z.object({ kind: z.enum(["bar", "line", "donut"]), points: z.array(point).max(40) }),
});
const body = z.object({ widgets: z.array(widget).max(24) });

/** The customer's saved dashboard, or a starting set built from their own data. */
export async function GET(request: Request): Promise<Response> {
  const ctx = await getSessionContext(new URL(request.url).searchParams.get("locale"));
  if (!ctx) return unauthorized();
  const saved = await readState<DashboardWidget[]>(ctx.customerRef, `dashboard:${ctx.locale}`);
  if (saved) return Response.json({ widgets: saved });

  const starters = [
    basketsTool(ctx, {}),
    spendingTool(ctx, {}),
    trendTool(ctx, {}),
    safeToSpendTool(ctx, {}),
  ];
  const widgets = starters.flatMap((result, index) =>
    result.card ? [{ id: `starter-${index}`, ...result.card }] : [],
  );
  return Response.json({ widgets });
}

export async function PUT(request: Request): Promise<Response> {
  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "invalid_request" }, { status: 400 });
  const ctx = await getSessionContext(new URL(request.url).searchParams.get("locale"));
  if (!ctx) return unauthorized();
  await writeState(ctx.customerRef, `dashboard:${ctx.locale}`, parsed.data.widgets);
  return Response.json({ ok: true });
}
