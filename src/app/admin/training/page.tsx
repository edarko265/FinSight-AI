import type { Metadata } from "next";

import { TrainingSection } from "@/components/admin/sections";

export const metadata: Metadata = { title: "Admin · Training · FinSight-AI" };

/** Renders once the admin shell has loaded the figures; nothing here is prerendered. */
export const instant = false;

export default function AdminTrainingPage(): React.JSX.Element {
  return <TrainingSection />;
}
