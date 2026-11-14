import type { Metadata } from "next";

import { AiSection } from "@/components/admin/sections";

export const metadata: Metadata = { title: "Admin · Ai · FinSight-AI" };

/** Renders once the admin shell has loaded the figures; nothing here is prerendered. */
export const instant = false;

export default function AdminAiPage(): React.JSX.Element {
  return <AiSection />;
}
