import { z } from "zod";

import { findCustomerRef } from "@/lib/data/repository";
import { createSession, passwordMatches, rateLimit } from "@/lib/security/session";

const body = z.object({
  customerId: z.string().trim().min(1).max(32),
  password: z.string().min(1).max(200),
});

export async function POST(request: Request): Promise<Response> {
  const client = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  if (!(await rateLimit(`login:${client}`, 10, 60_000))) {
    return Response.json({ error: "too_many_attempts" }, { status: 429 });
  }
  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "invalid_credentials" }, { status: 401 });

  // A second limit per account, so one customer ID cannot be hammered from many addresses.
  if (!(await rateLimit(`login-id:${parsed.data.customerId.toUpperCase()}`, 8, 15 * 60_000))) {
    return Response.json({ error: "too_many_attempts" }, { status: 429 });
  }

  // Check both, so a wrong password and an unknown customer are indistinguishable.
  const passwordOk = passwordMatches(parsed.data.password);
  const customerRef = await findCustomerRef(parsed.data.customerId.toUpperCase());
  if (!passwordOk || !customerRef) {
    return Response.json({ error: "invalid_credentials" }, { status: 401 });
  }
  await createSession(customerRef);
  return Response.json({ ok: true });
}
