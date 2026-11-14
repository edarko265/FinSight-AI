import { destroySession } from "@/lib/security/session";

export async function POST(): Promise<Response> {
  await destroySession();
  return Response.json({ ok: true });
}
