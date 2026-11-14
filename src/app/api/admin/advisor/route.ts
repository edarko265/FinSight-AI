import { isAdmin } from "@/lib/admin/auth";
import { advisorQueue } from "@/lib/advisor/handoff";

/** Requests customers have chosen to send to an adviser. Customers appear under a pseudonym. */
export async function GET(): Promise<Response> {
  if (!(await isAdmin())) return Response.json({ error: "unauthorized" }, { status: 401 });
  return Response.json({ queue: await advisorQueue() });
}
