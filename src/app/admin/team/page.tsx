import type { Metadata } from "next";

import { TeamSection } from "@/components/admin/sections";

export const metadata: Metadata = { title: "Admin · Team · FinSight-AI" };

/** Renders once the admin shell has loaded the figures; nothing here is prerendered. */
export const instant = false;

export default function AdminTeamPage(): React.JSX.Element {
  return <TeamSection />;
}
