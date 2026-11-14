import { z } from "zod";

import {
  listAnnouncements,
  setAnnouncementState,
  updateAnnouncement,
} from "@/lib/admin/announcements";
import { refuse } from "@/lib/admin/auth";
import { audit } from "@/lib/admin/settings";

import { announcementSchema } from "../route";

const action = z.object({ action: z.enum(["trash", "restore", "purge"]) });

/** Edits an announcement. */
export async function PATCH(
  request: Request,
  context: RouteContext<"/api/admin/announcements/[id]">,
): Promise<Response> {
  const refused = await refuse("manager");
  if (refused) return refused;
  const parsed = announcementSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "invalid_request" }, { status: 400 });
  await updateAnnouncement((await context.params).id, parsed.data);
  await audit("announcement.edit", parsed.data.title);
  return Response.json({ announcements: await listAnnouncements() });
}

/** Moves an announcement to the recycle bin, restores it, or deletes it permanently. */
export async function POST(
  request: Request,
  context: RouteContext<"/api/admin/announcements/[id]">,
): Promise<Response> {
  const refused = await refuse("manager");
  if (refused) return refused;
  const parsed = action.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "invalid_request" }, { status: 400 });
  await setAnnouncementState((await context.params).id, parsed.data.action);
  await audit(`announcement.${parsed.data.action}`);
  return Response.json({ announcements: await listAnnouncements() });
}
