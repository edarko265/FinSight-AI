import { recordedBalance } from "@/lib/analytics/spending";
import { getSessionContext, unauthorized } from "@/lib/coach/context";
import { allInsights } from "@/lib/coach/all-insights";
import { forecastFor } from "@/lib/coach/tools";
import { readState } from "@/lib/data/repository";

export async function GET(request: Request): Promise<Response> {
  const ctx = await getSessionContext(new URL(request.url).searchParams.get("locale"));
  if (!ctx) return unauthorized();
  const balance = recordedBalance(ctx.record.transactions, ctx.asOf);
  const forecast = forecastFor(ctx, { horizonDays: 7 });
  const read = new Set((await readState<string[]>(ctx.customerRef, "insights_read")) ?? []);
  return Response.json({
    asOf: ctx.asOf,
    balanceCents: balance?.balanceCents ?? 0,
    forecast: {
      status: forecast.status,
      availableCents: forecast.availableCents,
      shortfallCents: forecast.shortfallCents,
      horizonDays: forecast.assumptions.horizonDays,
    },
    unreadInsights: (await allInsights(ctx)).filter((insight) => !read.has(insight.id)).length,
  });
}
