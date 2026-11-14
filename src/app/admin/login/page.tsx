import type { Metadata } from "next";

import { AdminLogin } from "@/components/admin/AdminLogin";

export const metadata: Metadata = { title: "Admin sign-in · FinSight-AI" };

export default function AdminLoginPage(): React.JSX.Element {
  return <AdminLogin />;
}
