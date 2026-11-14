import { currentStaff, isManagerRole } from "@/lib/admin/auth";
import { aiRequestsToday, aiUsageSummary, auditLog, getSettings } from "@/lib/admin/settings";
import { systemStatus } from "@/lib/admin/system";
import { usageSummary } from "@/lib/admin/usage";
import { advisorWorkload } from "@/lib/advisor/handoff";
import { paymentTotals } from "@/lib/payments/payments";

/** Aggregate statistics and controls. Nothing here identifies or describes an individual customer. */
const PERIODS = [7, 30, 90];

export async function GET(request: Request): Promise<Response> {
  const me = await currentStaff();
  if (!me) return Response.json({ error: "unauthorized" }, { status: 401 });
  const asked = Number(new URL(request.url).searchParams.get("days"));
  const days = PERIODS.includes(asked) ? asked : 30;
  return Response.json({
    me,
    days,
    system: await systemStatus(),
    usage: await usageSummary(days),
    ai: { ...(await aiUsageSummary(days)), requestsToday: await aiRequestsToday() },
    workload: await advisorWorkload(),
    payments: await paymentTotals(),
    settings: await getSettings(),
    // What colleagues did is for administrators only.
    audit: isManagerRole(me.role) ? await auditLog() : [],
  });
}
