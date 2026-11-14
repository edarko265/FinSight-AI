import { isAdmin } from "@/lib/admin/auth";
import { aiRequestsToday, aiUsageSummary, auditLog, getSettings } from "@/lib/admin/settings";
import { systemStatus } from "@/lib/admin/system";
import { usageSummary } from "@/lib/admin/usage";
import { advisorWorkload } from "@/lib/advisor/handoff";

/** Aggregate statistics and controls. Nothing here identifies or describes an individual customer. */
export async function GET(): Promise<Response> {
  if (!(await isAdmin())) return Response.json({ error: "unauthorized" }, { status: 401 });
  return Response.json({
    system: await systemStatus(),
    usage: await usageSummary(),
    ai: { ...(await aiUsageSummary()), requestsToday: await aiRequestsToday() },
    workload: await advisorWorkload(),
    settings: await getSettings(),
    audit: await auditLog(),
  });
}
