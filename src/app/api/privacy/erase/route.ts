import { getSessionContext, unauthorized } from "@/lib/coach/context";
import { getDb } from "@/lib/db/client";
import { destroySession } from "@/lib/security/session";

/**
 * Erasure of everything the app itself created about the customer: saved
 * dashboards, read insights, the consent record and all sessions. The
 * transaction ledger is the bank's record in this demo and is not deleted
 * here; in production its removal is the bank's process (and a single key
 * retirement makes a customer's ledger unreadable).
 */
export async function POST(): Promise<Response> {
  const ctx = await getSessionContext();
  if (!ctx) return unauthorized();
  const db = await getDb();
  await db.query("DELETE FROM customer_state WHERE customer_ref = $1", [ctx.customerRef]);
  await db.query("DELETE FROM sessions WHERE customer_ref = $1", [ctx.customerRef]);
  await destroySession();
  return Response.json({ ok: true });
}
