import type { Metadata } from "next";

import { ControlsSection } from "@/components/admin/sections";

export const metadata: Metadata = { title: "Admin · Controls · FinSight-AI" };

/** Renders once the admin shell has loaded the figures; nothing here is prerendered. */
export const instant = false;

export default function AdminControlsPage(): React.JSX.Element {
  return <ControlsSection />;
}
