import { z } from "zod";

import { refuse } from "@/lib/admin/auth";
import { audit } from "@/lib/admin/settings";
import { createStaff, listStaff, STAFF_ROLES } from "@/lib/admin/staff";

const RESERVED = new Set(["admin", "owner", "root"]);

const create = z.object({
  name: z.string().trim().min(1).max(80),
  username: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9][a-z0-9._-]{2,39}$/)
    .refine((value) => !RESERVED.has(value)),
  role: z.enum(STAFF_ROLES),
  password: z.string().min(10).max(200),
});

/** The team: everyone who can sign in to the admin area besides the owner. */
export async function GET(): Promise<Response> {
  const refused = await refuse("manager");
  if (refused) return refused;
  return Response.json({ staff: await listStaff() });
}

export async function POST(request: Request): Promise<Response> {
  const refused = await refuse("manager");
  if (refused) return refused;
  const parsed = create.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "invalid_request" }, { status: 400 });
  if (!(await createStaff(parsed.data))) {
    return Response.json({ error: "username_taken" }, { status: 409 });
  }
  // The role only: a colleague's name does not belong in the log in readable form.
  await audit("staff.create", parsed.data.role);
  return Response.json({ staff: await listStaff() });
}
