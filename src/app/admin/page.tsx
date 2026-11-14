import type { Metadata } from "next";

import { OverviewSection } from "@/components/admin/sections";

export const metadata: Metadata = { title: "Admin · Overview · FinSight-AI" };

/** Renders once the admin shell has loaded the figures; nothing here is prerendered. */
export const instant = false;

export default function AdminOverviewPage(): React.JSX.Element {
  return <OverviewSection />;
}
