"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { usePreferences } from "@/components/providers/PreferencesProvider";
import { LanguagePicker } from "@/components/settings/LanguagePicker";
import { Logo } from "@/components/ui/icons";
import { PasswordField } from "@/components/ui/PasswordField";
import { Suggestions, Wizard, WizardField } from "@/components/ui/Wizard";
import { api, ApiError } from "@/lib/api-client";
import { DEMO_PERSONAS } from "@/lib/demo/personas";

/** The sign-in page: a welcome with one button, which opens a two-step sign-in. */
export function LoginForm({ demoPassword }: { demoPassword: string | null }): React.JSX.Element {
  const { t } = usePreferences();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [customerId, setCustomerId] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<"login.error" | "login.tooMany" | "login.unavailable" | null>(
    null,
  );

  async function signIn(): Promise<void> {
    setError(null);
    try {
      await api("/api/auth/login", { method: "POST", json: { customerId, password } });
      router.replace("/dashboard");
    } catch (failure) {
      const status = failure instanceof ApiError ? failure.status : 0;
      // A server fault is not the user's mistake: say so instead of blaming the password.
      setError(
        status === 429 ? "login.tooMany" : status === 401 ? "login.error" : "login.unavailable",
      );
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-8 px-5 py-8">
      <LanguagePicker compact />

      <header className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
        <Logo className="size-20" />
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">{t("app.name")}</h1>
          <p className="mt-2 text-base text-muted">{t("login.subtitle")}</p>
        </div>
      </header>

      <div className="flex flex-col gap-3">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="rounded-full bg-primary px-5 py-4 text-base font-semibold text-on-primary"
        >
          {t("login.start")}
        </button>
        <Link href="/forgot-password" className="text-center text-sm font-medium text-accent">
          {t("login.forgot")}
        </Link>
        <p className="text-center text-xs text-muted">{t("login.notBank")}</p>
      </div>

      <Wizard
        open={open}
        title={t("login.title")}
        finishLabel={t("login.submit")}
        error={error ? t(error) : null}
        onClose={() => {
          setOpen(false);
          setError(null);
        }}
        onFinish={signIn}
        steps={[
          {
            title: t("login.step.id"),
            hint: t("login.step.idHint"),
            valid: customerId.trim().length > 0,
            content: (
              <>
                <WizardField
                  label={t("login.customerId")}
                  value={customerId}
                  onChange={(event) => setCustomerId(event.target.value)}
                  placeholder={t("login.customerIdHint")}
                  autoComplete="username"
                  autoCapitalize="characters"
                  autoFocus
                />
                {demoPassword ? (
                  <Suggestions
                    label={t("login.demoTitle")}
                    options={DEMO_PERSONAS.map((persona) => ({
                      label: `${t(persona.label)} · ${persona.customerId}`,
                      value: persona.customerId,
                    }))}
                    onPick={setCustomerId}
                  />
                ) : null}
              </>
            ),
          },
          {
            title: t("login.step.password"),
            hint: t("login.step.passwordHint"),
            valid: password.length > 0,
            content: (
              <>
                <PasswordField
                  id="password"
                  label={t("login.password")}
                  value={password}
                  onChange={setPassword}
                />
                {demoPassword ? (
                  <Suggestions
                    label={t("wizard.suggestions")}
                    options={[{ label: t("login.useDemoPassword"), value: demoPassword }]}
                    onPick={setPassword}
                  />
                ) : null}
              </>
            ),
          },
        ]}
      />
    </main>
  );
}
