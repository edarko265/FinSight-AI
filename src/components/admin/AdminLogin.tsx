"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { usePreferences } from "@/components/providers/PreferencesProvider";
import { ThemeToggle } from "@/components/admin/AdminShell";
import { LanguagePicker } from "@/components/settings/LanguagePicker";
import { Logo } from "@/components/ui/icons";
import { PasswordField } from "@/components/ui/PasswordField";
import { Wizard, WizardField } from "@/components/ui/Wizard";
import { api, ApiError } from "@/lib/api-client";
import type { MessageKey } from "@/lib/i18n/translate";

export function AdminLogin(): React.JSX.Element {
  const { t } = usePreferences();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [needsCode, setNeedsCode] = useState(false);
  const [code, setCode] = useState("");
  const [error, setError] = useState<MessageKey | null>(null);

  async function signIn(): Promise<boolean> {
    setError(null);
    try {
      await api("/api/admin/login", {
        method: "POST",
        json: {
          username: username.trim() || undefined,
          password,
          code: needsCode ? code : undefined,
        },
      });
      router.replace("/admin");
      return true;
    } catch (failure) {
      const status = failure instanceof ApiError ? failure.status : 0;
      if (failure instanceof ApiError && failure.code === "totp_required") {
        setNeedsCode(true);
        return false;
      }
      // A server fault is not the user's mistake: say so instead of blaming the password.
      setError(
        status === 429 ? "login.tooMany" : status === 401 ? "login.error" : "login.unavailable",
      );
      return false;
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-8 px-5 py-8">
      <div className="flex items-center justify-end gap-2">
        <LanguagePicker compact />
        <ThemeToggle />
      </div>
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
            title: t("admin.login.who"),
            hint: t("admin.login.whoHint"),
            valid: true,
            content: (
              <WizardField
                label={t("admin.login.username")}
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                placeholder={t("admin.login.usernamePlaceholder")}
                autoCapitalize="none"
                autoComplete="username"
                maxLength={40}
                autoFocus
              />
            ),
          },
          {
            title: t(username.trim() ? "login.password" : "admin.login.step"),
            hint: t(username.trim() ? "admin.login.staffHint" : "admin.login.stepHint"),
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
          ...(needsCode
            ? [
                {
                  title: t("twoStep.code"),
                  hint: t("twoStep.loginHint"),
                  valid: /^\d{6}$/.test(code.replace(/\s/g, "")),
                  content: (
                    <WizardField
                      label={t("twoStep.code")}
                      value={code}
                      onChange={(event) => setCode(event.target.value)}
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      placeholder="123456"
                      maxLength={7}
                      autoFocus
                    />
                  ),
                },
              ]
            : []),
        ]}
      />
    </main>
  );
}
