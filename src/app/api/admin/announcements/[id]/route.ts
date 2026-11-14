import { z } from "zod";

import {
  listAnnouncements,
  setAnnouncementState,
  updateAnnouncement,
} from "@/lib/admin/announcements";
import { isAdmin } from "@/lib/admin/auth";

const unauthorized = (): Response => Response.json({ error: "unauthorized" }, { status: 401 });

const edit = z.object({
  title: z.string().trim().min(1).max(120),
  body: z.string().trim().min(1).max(600),
  severity: z.enum(["info", "warning", "good"]),
});
const action = z.object({ action: z.enum(["trash", "restore", "purge"]) });

/** Edits an announcement. */
export async function PATCH(
  request: Request,
  context: RouteContext<"/api/admin/announcements/[id]">,
): Promise<Response> {
  if (!(await isAdmin())) return unauthorized();
  const parsed = edit.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "invalid_request" }, { status: 400 });
  await updateAnnouncement((await context.params).id, parsed.data);
  return Response.json({ announcements: await listAnnouncements() });
}

/** Moves an announcement to the recycle bin, restores it, or deletes it permanently. */
export async function POST(
  request: Request,
  context: RouteContext<"/api/admin/announcements/[id]">,
): Promise<Response> {
  if (!(await isAdmin())) return unauthorized();
  const parsed = action.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "invalid_request" }, { status: 400 });
  await setAnnouncementState((await context.params).id, parsed.data.action);
  return Response.json({ announcements: await listAnnouncements() });
}
