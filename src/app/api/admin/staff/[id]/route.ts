import { z } from "zod";

import { currentStaff, refuse } from "@/lib/admin/auth";
import { audit } from "@/lib/admin/settings";
import { listStaff, setStaffState, STAFF_ROLES, updateStaff } from "@/lib/admin/staff";

const edit = z.object({
  name: z.string().trim().min(1).max(80),
  role: z.enum(STAFF_ROLES),
  /** Left out to keep the current password. */
  password: z.string().min(10).max(200).optional(),
});
const action = z.object({ action: z.enum(["trash", "restore", "purge"]) });

/** Changes a member's name, role or password. */
export async function PATCH(
  request: Request,
  context: RouteContext<"/api/admin/staff/[id]">,
): Promise<Response> {
  const refused = await refuse("manager");
  if (refused) return refused;
  const parsed = edit.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "invalid_request" }, { status: 400 });
  if (!(await updateStaff((await context.params).id, parsed.data))) {
    return Response.json({ error: "not_found" }, { status: 404 });
  }
  await audit(
    "staff.edit",
    parsed.data.password ? `${parsed.data.role}, new password` : parsed.data.role,
  );
  return Response.json({ staff: await listStaff() });
}

/** Moves a member to the recycle bin (ending their access), restores them, or deletes them for good. */
export async function POST(
  request: Request,
  context: RouteContext<"/api/admin/staff/[id]">,
): Promise<Response> {
  const refused = await refuse("manager");
  if (refused) return refused;
  const parsed = action.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "invalid_request" }, { status: 400 });
  const { id } = await context.params;
  // Nobody removes their own access by accident.
  if ((await currentStaff())?.id === id) {
    return Response.json({ error: "cannot_remove_self" }, { status: 409 });
  }
  await setStaffState(id, parsed.data.action);
  await audit(`staff.${parsed.data.action}`);
  return Response.json({ staff: await listStaff() });
}
