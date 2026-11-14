import { z } from "zod";

import { createAnnouncement, listAnnouncements } from "@/lib/admin/announcements";
import { isAdmin } from "@/lib/admin/auth";
import { pushToEveryone } from "@/lib/push/push";
import { audit } from "@/lib/admin/settings";

const unauthorized = (): Response => Response.json({ error: "unauthorized" }, { status: 401 });

const announcementSchema = z.object({
  title: z.string().trim().min(1).max(120),
  body: z.string().trim().min(1).max(600),
  severity: z.enum(["info", "warning", "good"]),
});

export async function GET(): Promise<Response> {
  if (!(await isAdmin())) return unauthorized();
  return Response.json({ announcements: await listAnnouncements() });
}

export async function POST(request: Request): Promise<Response> {
  if (!(await isAdmin())) return unauthorized();
  const parsed = announcementSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "invalid_request" }, { status: 400 });
  await createAnnouncement(parsed.data);
  await audit("announcement.create", parsed.data.title);
  // A general notice, so it may go through the push service. Never personal figures.
  const reached = await pushToEveryone({
    title: parsed.data.title,
    body: parsed.data.body,
    url: "/insights",
  });
  if (reached > 0) await audit("announcement.push", `${reached} devices`);
  return Response.json({ announcements: await listAnnouncements() });
}
