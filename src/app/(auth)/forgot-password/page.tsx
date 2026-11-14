import type { Metadata } from "next";

import { ForgotPasswordForm } from "@/components/auth/ForgotPasswordForm";

export const metadata: Metadata = { title: "Reset password · FinSight-AI" };

export default function ForgotPasswordPage(): React.JSX.Element {
  return <ForgotPasswordForm />;
}
