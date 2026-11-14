import { z } from "zod";

import { adminPasswordMatches, createAdminSession, OWNER_ID } from "@/lib/admin/auth";
import { audit } from "@/lib/admin/settings";
import { verifyStaff } from "@/lib/admin/staff";
import { rateLimit } from "@/lib/security/session";

const body = z.object({
  /** Empty for the installation owner, who signs in with the admin password alone. */
  username: z.string().trim().max(40).optional(),
  password: z.string().min(1).max(200),
});

export async function POST(request: Request): Promise<Response> {
  const client = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  if (!(await rateLimit(`admin:${client}`, 5, 60_000))) {
    return Response.json({ error: "too_many_attempts" }, { status: 429 });
  }
  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "invalid_credentials" }, { status: 401 });
  }
  const { username, password } = parsed.data;
  let staffId: string | null = null;
  if (username) {
    staffId = (await verifyStaff(username, password))?.id ?? null;
  } else if (adminPasswordMatches(password)) {
    staffId = OWNER_ID;
  }
  if (!staffId) {
    await audit("admin.sign_in_failed", username ? "staff account" : "owner");
    return Response.json({ error: "invalid_credentials" }, { status: 401 });
  }
  await createAdminSession(staffId);
  await audit("admin.sign_in", "", staffId);
  return Response.json({ ok: true });
}
