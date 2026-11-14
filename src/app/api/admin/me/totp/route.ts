import QRCode from "qrcode";
import { z } from "zod";

import { currentStaff, OWNER_ID } from "@/lib/admin/auth";
import { audit } from "@/lib/admin/settings";
import {
  activeStaff,
  beginStaffTwoStep,
  confirmStaffTwoStep,
  disableStaffTwoStep,
} from "@/lib/admin/staff";
import { rateLimit } from "@/lib/security/session";
import { totpUri } from "@/lib/security/totp";

const body = z.discriminatedUnion("action", [
  z.object({ action: z.literal("begin") }),
  z.object({ action: z.literal("confirm"), code: z.string().min(6).max(10) }),
  z.object({ action: z.literal("disable"), code: z.string().min(6).max(10) }),
]);

/** Whether the signed-in member uses two-step sign-in. */
export async function GET(): Promise<Response> {
  const me = await currentStaff();
  if (!me) return Response.json({ error: "unauthorized" }, { status: 401 });
  if (me.id === OWNER_ID) return Response.json({ enabled: false, owner: true });
  return Response.json({ enabled: (await activeStaff(me.id))?.twoStep ?? false, owner: false });
}

/** A member of staff sets up or removes two-step sign-in for their own account. */
export async function POST(request: Request): Promise<Response> {
  const me = await currentStaff();
  if (!me) return Response.json({ error: "unauthorized" }, { status: 401 });
  if (me.id === OWNER_ID) return Response.json({ error: "owner_password" }, { status: 400 });
  if (!(await rateLimit(`staff-totp:${me.id}`, 8, 60_000))) {
    return Response.json({ error: "too_many_attempts" }, { status: 429 });
  }
  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "invalid_request" }, { status: 400 });
  const input = parsed.data;
  if (input.action === "begin") {
    const started = await beginStaffTwoStep(me.id);
    if (!started) return Response.json({ error: "not_found" }, { status: 404 });
    return Response.json({
      secret: started.secret,
      qr: await QRCode.toDataURL(totpUri(started.secret, started.account), {
        margin: 1,
        width: 220,
      }),
    });
  }
  const ok =
    input.action === "confirm"
      ? await confirmStaffTwoStep(me.id, input.code)
      : await disableStaffTwoStep(me.id, input.code);
  if (!ok) return Response.json({ error: "wrong_code" }, { status: 400 });
  await audit(input.action === "confirm" ? "staff.two_step_on" : "staff.two_step_off");
  return Response.json({ enabled: input.action === "confirm" });
}
