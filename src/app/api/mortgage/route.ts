import { getSessionContext, termsRequired, unauthorized } from "@/lib/coach/context";
import type { MortgageStats } from "@/lib/data/mortgage";
import { getDb } from "@/lib/db/client";

/**
 * The mortgage guide: anonymous figures across the applications in the
 * dataset, and the signed-in customer's own application if they have one.
 * For teaching. It never says whether anyone would be approved.
 */
export async function GET(): Promise<Response> {
  const ctx = await getSessionContext();
  if (!ctx) return unauthorized();
  const blocked = await termsRequired(ctx);
  if (blocked) return blocked;
  const db = await getDb();
  const rows = await db.query<{ value: string }>(
    "SELECT value FROM app_settings WHERE key = 'mortgage_stats'",
  );
  let stats: MortgageStats | null = null;
  try {
    stats = rows[0] ? (JSON.parse(rows[0].value) as MortgageStats) : null;
  } catch {
    stats = null;
  }
  return Response.json({ stats, story: ctx.record.mortgage ?? null });
}
