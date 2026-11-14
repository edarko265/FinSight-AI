import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";

import { LoginForm } from "@/components/auth/LoginForm";
import { getEnv } from "@/lib/env";

export const metadata: Metadata = { title: "Sign in · FinSight-AI" };

/** In demo mode the shared demo password is offered on the page; otherwise it is never sent. */
async function Login(): Promise<React.JSX.Element> {
  await connection();
  const env = getEnv();
  return <LoginForm demoPassword={env.DEMO_MODE ? (env.DEMO_LOGIN_PASSWORD ?? null) : null} />;
}

export default function LoginPage(): React.JSX.Element {
  return (
    <Suspense>
      <Login />
    </Suspense>
  );
}
