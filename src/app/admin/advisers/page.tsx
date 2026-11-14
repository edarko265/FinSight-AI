import type { Metadata } from "next";

import { AdvisersSection } from "@/components/admin/sections";

export const metadata: Metadata = { title: "Admin · Advisers · FinSight-AI" };

/** Renders once the admin shell has loaded the figures; nothing here is prerendered. */
export const instant = false;

export default function AdminAdvisersPage(): React.JSX.Element {
  return <AdvisersSection />;
}
