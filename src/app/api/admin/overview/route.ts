import { currentStaff, isManagerRole } from "@/lib/admin/auth";
import { aiRequestsToday, aiUsageSummary, auditLog, getSettings } from "@/lib/admin/settings";
import { systemStatus } from "@/lib/admin/system";
import { usageSummary } from "@/lib/admin/usage";
import { advisorWorkload } from "@/lib/advisor/handoff";

/** Aggregate statistics and controls. Nothing here identifies or describes an individual customer. */
export async function GET(): Promise<Response> {
  const me = await currentStaff();
  if (!me) return Response.json({ error: "unauthorized" }, { status: 401 });
  return Response.json({
    me,
    system: await systemStatus(),
    usage: await usageSummary(),
    ai: { ...(await aiUsageSummary()), requestsToday: await aiRequestsToday() },
    workload: await advisorWorkload(),
    settings: await getSettings(),
    // What colleagues did is for administrators only.
    audit: isManagerRole(me.role) ? await auditLog() : [],
  });
}
