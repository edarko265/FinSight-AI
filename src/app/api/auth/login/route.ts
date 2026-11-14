import { z } from "zod";

import { findCustomerRef } from "@/lib/data/repository";
import {
  clearFailures,
  createSession,
  isLockedOut,
  passwordMatches,
  rateLimit,
  recordFailure,
} from "@/lib/security/session";
import { passesTwoStep } from "@/lib/security/two-step";

const body = z.object({
  customerId: z.string().trim().min(1).max(32),
  password: z.string().min(1).max(200),
  /** The six-digit code, when the customer has two-step sign-in on. */
  code: z.string().max(10).optional(),
});

export async function POST(request: Request): Promise<Response> {
  const client = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  if (!(await rateLimit(`login:${client}`, 10, 60_000))) {
    return Response.json({ error: "too_many_attempts" }, { status: 429 });
  }
  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "invalid_credentials" }, { status: 401 });

  // Failed attempts are also counted per account, so one customer ID cannot be hammered from
  // many addresses. A successful sign-in clears the count.
  const accountKey = `login-id:${parsed.data.customerId.toUpperCase()}`;
  if (await isLockedOut(accountKey, 8, 15 * 60_000)) {
    return Response.json({ error: "too_many_attempts" }, { status: 429 });
  }

  // Check both, so a wrong password and an unknown customer are indistinguishable.
  const passwordOk = passwordMatches(parsed.data.password);
  const customerRef = await findCustomerRef(parsed.data.customerId.toUpperCase());
  if (!passwordOk || !customerRef) {
    await recordFailure(accountKey, 15 * 60_000);
    return Response.json({ error: "invalid_credentials" }, { status: 401 });
  }
  // Second step, for customers who switched it on. The password was right, so saying that a
  // code is needed reveals nothing an attacker without the password could learn.
  if (!(await passesTwoStep(customerRef, parsed.data.code))) {
    if (parsed.data.code) await recordFailure(accountKey, 15 * 60_000);
    return Response.json(
      { error: parsed.data.code ? "totp_invalid" : "totp_required" },
      { status: 401 },
    );
  }
  await clearFailures(accountKey);
  await createSession(customerRef);
  return Response.json({ ok: true });
}
