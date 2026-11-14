import type { Metadata } from "next";

import { AnnouncementsSection } from "@/components/admin/sections";

export const metadata: Metadata = { title: "Admin · Announcements · FinSight-AI" };

/** Renders once the admin shell has loaded the figures; nothing here is prerendered. */
export const instant = false;

export default function AdminAnnouncementsPage(): React.JSX.Element {
  return <AnnouncementsSection />;
}
