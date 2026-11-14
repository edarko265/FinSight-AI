import { z } from "zod";

import { currentStaff, OWNER_ID } from "@/lib/admin/auth";
import { audit } from "@/lib/admin/settings";
import { changeOwnPassword } from "@/lib/admin/staff";
import { rateLimit } from "@/lib/security/session";

const body = z.object({
  current: z.string().min(1).max(200),
  next: z.string().min(10).max(200),
});

/** A member of staff changes their own password. The owner's password is set in the environment. */
export async function POST(request: Request): Promise<Response> {
  const me = await currentStaff();
  if (!me) return Response.json({ error: "unauthorized" }, { status: 401 });
  if (me.id === OWNER_ID) return Response.json({ error: "owner_password" }, { status: 400 });
  if (!(await rateLimit(`staff-password:${me.id}`, 5, 60_000))) {
    return Response.json({ error: "too_many_attempts" }, { status: 429 });
  }
  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "invalid_request" }, { status: 400 });
  if (!(await changeOwnPassword(me.id, parsed.data.current, parsed.data.next))) {
    return Response.json({ error: "wrong_password" }, { status: 400 });
  }
  await audit("staff.own_password");
  return Response.json({ ok: true });
}
