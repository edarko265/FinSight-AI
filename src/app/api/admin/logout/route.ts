import { destroyAdminSession } from "@/lib/admin/auth";

export async function POST(): Promise<Response> {
  await destroyAdminSession();
  return Response.json({ ok: true });
}
