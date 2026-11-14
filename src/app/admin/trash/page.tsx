import type { Metadata } from "next";

import { TrashSection } from "@/components/admin/sections";

export const metadata: Metadata = { title: "Admin · Trash · FinSight-AI" };

/** Renders once the admin shell has loaded the figures; nothing here is prerendered. */
export const instant = false;

export default function AdminTrashPage(): React.JSX.Element {
  return <TrashSection />;
}
