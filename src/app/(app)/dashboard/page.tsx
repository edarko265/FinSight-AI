import type { Metadata } from "next";
import { DashboardView } from "@/components/dashboard/DashboardView";

export const metadata: Metadata = { title: "Dashboard · FinSight-AI" };

/** Waits for the signed-in account state before rendering; see the (app) layout. */
export const instant = false;

export default function DashboardPage(): React.JSX.Element {
  return <DashboardView />;
}
