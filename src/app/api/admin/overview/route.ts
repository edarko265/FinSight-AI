import { isAdmin } from "@/lib/admin/auth";
import { systemStatus } from "@/lib/admin/system";
import { usageSummary } from "@/lib/admin/usage";

/** Aggregate statistics only. Nothing here identifies or describes an individual customer. */
export async function GET(): Promise<Response> {
  if (!(await isAdmin())) return Response.json({ error: "unauthorized" }, { status: 401 });
  return Response.json({ system: await systemStatus(), usage: await usageSummary() });
}
