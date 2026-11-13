import type { Metadata } from "next";
import { DashboardView } from "@/components/dashboard/DashboardView";

export const metadata: Metadata = { title: "Dashboard · FinSight-AI" };

export default function DashboardPage(): React.JSX.Element {
  return <DashboardView />;
}
