import type { Metadata } from "next";

import { PlansSection } from "@/components/admin/sections";

export const metadata: Metadata = { title: "Admin · Shared plans · FinSight-AI" };

/** Renders once the admin shell has loaded the figures; nothing here is prerendered. */
export const instant = false;

export default function AdminPlansPage(): React.JSX.Element {
  return <PlansSection />;
}
