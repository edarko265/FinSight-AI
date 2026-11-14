import type { Metadata } from "next";

import { AdminDashboard } from "@/components/admin/AdminDashboard";

export const metadata: Metadata = { title: "Admin · FinSight-AI" };

export default function AdminPage(): React.JSX.Element {
  return <AdminDashboard />;
}
