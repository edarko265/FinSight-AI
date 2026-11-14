import { classify } from "@/lib/analytics/classify";
import { readConsent } from "@/lib/coach/consent";
import { getSessionContext, unauthorized } from "@/lib/coach/context";
import { readState } from "@/lib/data/repository";

/**
 * Data portability: everything the app holds about the signed-in customer, as
 * one machine-readable file. Covers the right of access and the right to
 * data portability.
 */
export async function GET(): Promise<Response> {
  const ctx = await getSessionContext();
  if (!ctx) return unauthorized();
  const payload = {
    exportedAt: new Date().toISOString(),
    notice: "Synthetic demo data. Amounts are integer cents in EUR.",
    profile: ctx.record.profile,
    consent: await readConsent(ctx.customerRef),
    dashboard: await readState(ctx.customerRef, "views"),
    goals: await readState(ctx.customerRef, "goals"),
    readInsights: await readState(ctx.customerRef, "insights_read"),
    transactions: ctx.record.transactions.map((tx) => ({ ...tx, classification: classify(tx) })),
  };
  return new Response(JSON.stringify(payload, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": 'attachment; filename="finsight-my-data.json"',
      "Cache-Control": "no-store",
    },
  });
}
