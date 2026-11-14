import type { Metadata } from "next";

import { SystemSection } from "@/components/admin/sections";

export const metadata: Metadata = { title: "Admin · System · FinSight-AI" };

/** Renders once the admin shell has loaded the figures; nothing here is prerendered. */
export const instant = false;

export default function AdminSystemPage(): React.JSX.Element {
  return <SystemSection />;
}
