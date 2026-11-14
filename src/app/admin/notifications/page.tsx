import type { Metadata } from "next";

import { NotificationsSection } from "@/components/admin/sections";

export const metadata: Metadata = { title: "Admin · Notifications · FinSight-AI" };

/** Renders once the admin shell has loaded the figures; nothing here is prerendered. */
export const instant = false;

export default function AdminNotificationsPage(): React.JSX.Element {
  return <NotificationsSection />;
}
