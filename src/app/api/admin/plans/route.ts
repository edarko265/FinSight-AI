import { z } from "zod";

import { refuse } from "@/lib/admin/auth";
import { audit } from "@/lib/admin/settings";
import { allSharedPlans, dismissReports, planReports, removeSharedPlan } from "@/lib/coach/plans";

/**
 * Shared plans, for moderation. Staff see what every customer with the code
 * could see: a name and percentages. Not who shared it, and no amounts.
 */
export async function GET(): Promise<Response> {
  const refused = await refuse("staff");
  if (refused) return refused;
  return Response.json({ plans: await allSharedPlans(), reports: await planReports() });
}

const body = z.object({
  code: z.string().min(4).max(20),
  /** "dismiss" clears the reports and leaves the plan shared. */
  action: z.enum(["remove", "dismiss"]).default("remove"),
});

/** Stops a plan being shared, for example because of its name. The owner keeps their own plan. */
export async function DELETE(request: Request): Promise<Response> {
  const refused = await refuse("staff");
  if (refused) return refused;
  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "invalid_request" }, { status: 400 });
  if (parsed.data.action === "dismiss") {
    await dismissReports(parsed.data.code);
    await audit("shared_plan.dismiss_reports");
  } else {
    await removeSharedPlan(parsed.data.code);
    await audit("shared_plan.remove");
  }
  return Response.json({ plans: await allSharedPlans(), reports: await planReports() });
}
