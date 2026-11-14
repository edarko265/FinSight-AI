import { z } from "zod";

import { isAdmin } from "@/lib/admin/auth";
import { advisorReply, advisorThread, closeRequest } from "@/lib/advisor/handoff";

const unauthorized = (): Response => Response.json({ error: "unauthorized" }, { status: 401 });

export async function GET(
  _request: Request,
  context: RouteContext<"/api/admin/advisor/[id]">,
): Promise<Response> {
  if (!(await isAdmin())) return unauthorized();
  const { id } = await context.params;
  const thread = await advisorThread(id);
  return thread
    ? Response.json({ thread })
    : Response.json({ error: "not_found" }, { status: 404 });
}

const body = z.union([
  z.object({ text: z.string().trim().min(1).max(2000) }),
  z.object({ action: z.literal("close") }),
]);

export async function POST(
  request: Request,
  context: RouteContext<"/api/admin/advisor/[id]">,
): Promise<Response> {
  if (!(await isAdmin())) return unauthorized();
  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "invalid_request" }, { status: 400 });
  const { id } = await context.params;
  if ("action" in parsed.data) {
    await closeRequest(id);
  } else if (!(await advisorReply(id, parsed.data.text))) {
    return Response.json({ error: "not_found" }, { status: 404 });
  }
  return Response.json({ thread: await advisorThread(id) });
}
