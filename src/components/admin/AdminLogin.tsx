"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { usePreferences } from "@/components/providers/PreferencesProvider";
import { LanguagePicker } from "@/components/settings/LanguagePicker";
import { Logo } from "@/components/ui/icons";
import { PasswordField } from "@/components/ui/PasswordField";
import { Wizard } from "@/components/ui/Wizard";
import { api, ApiError } from "@/lib/api-client";

export function AdminLogin(): React.JSX.Element {
  const { t } = usePreferences();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [error, setError] = useState<"login.error" | "login.tooMany" | null>(null);

  async function signIn(): Promise<void> {
    setError(null);
    try {
      await api("/api/admin/login", { method: "POST", json: { password } });
      router.replace("/admin");
    } catch (failure) {
      setError(
        failure instanceof ApiError && failure.status === 429 ? "login.tooMany" : "login.error",
      );
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-8 px-5 py-8">
      <LanguagePicker compact />
      <header className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
        <Logo className="size-16" />
        <h1 className="text-2xl font-semibold tracking-tight">{t("admin.title")}</h1>
        <p className="text-sm text-muted">{t("admin.login.hint")}</p>
      </header>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-full bg-primary px-5 py-4 text-base font-semibold text-on-primary"
      >
        {t("admin.login.start")}
      </button>

      <Wizard
        open={open}
        title={t("admin.login.title")}
        finishLabel={t("login.submit")}
        error={error ? t(error) : null}
        onClose={() => {
          setOpen(false);
          setError(null);
        }}
        onFinish={signIn}
        steps={[
          {
            title: t("admin.login.step"),
            hint: t("admin.login.stepHint"),
            valid: password.length > 0,
            content: (
              <PasswordField
                id="admin-password"
                label={t("login.password")}
                value={password}
                onChange={setPassword}
              />
            ),
          },
        ]}
      />
    </main>
  );
}
