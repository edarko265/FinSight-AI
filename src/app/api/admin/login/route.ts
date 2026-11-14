import { z } from "zod";

import { adminPasswordMatches, createAdminSession } from "@/lib/admin/auth";
import { audit } from "@/lib/admin/settings";
import { rateLimit } from "@/lib/security/session";

const body = z.object({ password: z.string().min(1).max(200) });

export async function POST(request: Request): Promise<Response> {
  const client = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  if (!rateLimit(`admin:${client}`, 5, 60_000)) {
    return Response.json({ error: "too_many_attempts" }, { status: 429 });
  }
  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success || !adminPasswordMatches(parsed.data.password)) {
    return Response.json({ error: "invalid_credentials" }, { status: 401 });
  }
  await createAdminSession();
  await audit("admin.sign_in");
  return Response.json({ ok: true });
}
