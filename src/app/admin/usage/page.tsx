import type { Metadata } from "next";

import { UsageSection } from "@/components/admin/sections";

export const metadata: Metadata = { title: "Admin · Usage · FinSight-AI" };

/** Renders once the admin shell has loaded the figures; nothing here is prerendered. */
export const instant = false;

export default function AdminUsagePage(): React.JSX.Element {
  return <UsageSection />;
}
