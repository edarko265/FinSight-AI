import { getSessionContext, unauthorized } from "@/lib/coach/context";
import { buildInsights } from "@/lib/coach/insights";
import { readState, writeState } from "@/lib/data/repository";

export async function GET(request: Request): Promise<Response> {
  const ctx = await getSessionContext(new URL(request.url).searchParams.get("locale"));
  if (!ctx) return unauthorized();
  const read = new Set((await readState<string[]>(ctx.customerRef, "insights_read")) ?? []);
  return Response.json({
    insights: buildInsights(ctx).map((insight) => ({ ...insight, read: read.has(insight.id) })),
  });
}

/** Marks every current insight as read. */
export async function POST(): Promise<Response> {
  const ctx = await getSessionContext();
  if (!ctx) return unauthorized();
  await writeState(
    ctx.customerRef,
    "insights_read",
    buildInsights(ctx).map((insight) => insight.id),
  );
  return Response.json({ ok: true });
}
