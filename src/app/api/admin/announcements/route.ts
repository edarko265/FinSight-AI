import { z } from "zod";

import { createAnnouncement, listAnnouncements } from "@/lib/admin/announcements";
import { refuse } from "@/lib/admin/auth";
import { pushToEveryone } from "@/lib/push/push";
import { audit } from "@/lib/admin/settings";

const wording = z.object({ title: z.string().trim().max(120), body: z.string().trim().max(600) });
export const announcementSchema = z.object({
  title: z.string().trim().min(1).max(120),
  body: z.string().trim().min(1).max(600),
  severity: z.enum(["info", "warning", "good"]),
  /** When to publish. Left out or null means now. */
  publishAt: z.string().datetime().nullable().optional(),
  translations: z.object({ fi: wording.optional(), sv: wording.optional() }).optional(),
});

export async function GET(): Promise<Response> {
  const refused = await refuse("manager");
  if (refused) return refused;
  return Response.json({ announcements: await listAnnouncements() });
}

export async function POST(request: Request): Promise<Response> {
  const refused = await refuse("manager");
  if (refused) return refused;
  const parsed = announcementSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "invalid_request" }, { status: 400 });
  const live = await createAnnouncement(parsed.data);
  await audit(live ? "announcement.create" : "announcement.schedule", parsed.data.title);
  if (live) {
    // A general notice, so it may go through the push service. Never personal figures.
    const reached = await pushToEveryone({
      title: parsed.data.title,
      body: parsed.data.body,
      url: "/insights",
    });
    if (reached > 0) await audit("announcement.push", `${reached} devices`);
  }
  return Response.json({ announcements: await listAnnouncements() });
}
