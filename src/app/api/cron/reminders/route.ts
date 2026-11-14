import { timingSafeEqual } from "node:crypto";

import { audit } from "@/lib/admin/settings";
import { getEnv } from "@/lib/env";
import { runReminders } from "@/lib/push/reminders";

export const maxDuration = 60;

/**
 * Runs the reminder job on a schedule (see vercel.json). The scheduler must
 * present CRON_SECRET; without the secret configured the route is closed.
 */
export async function GET(request: Request): Promise<Response> {
  // Reading the request first also tells the framework this route runs per request and is
  // never evaluated while building.
  const given = request.headers.get("authorization") ?? "";
  const secret = getEnv().CRON_SECRET;
  const expected = `Bearer ${secret ?? ""}`;
  if (
    !secret ||
    given.length !== expected.length ||
    !timingSafeEqual(Buffer.from(given), Buffer.from(expected))
  ) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  const result = await runReminders();
  await audit("reminders.scheduled", `${result.sent} sent to ${result.customers} customers`);
  return Response.json(result);
}
