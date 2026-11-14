import { refuse } from "@/lib/admin/auth";
import { advisorQueue } from "@/lib/advisor/handoff";

/** Requests customers have chosen to send to an adviser. Customers appear under a pseudonym. */
export async function GET(): Promise<Response> {
  const refused = await refuse("staff");
  if (refused) return refused;
  return Response.json({ queue: await advisorQueue() });
}
