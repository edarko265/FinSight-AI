"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { usePreferences } from "@/components/providers/PreferencesProvider";
import { LanguagePicker } from "@/components/settings/LanguagePicker";
import { EyeIcon, EyeOffIcon, Logo } from "@/components/ui/icons";
import { api, ApiError } from "@/lib/api-client";
import { DEMO_PERSONAS } from "@/lib/demo/personas";

export function LoginForm({ demoPassword }: { demoPassword: string | null }): React.JSX.Element {
  const { t } = usePreferences();
  const router = useRouter();
  const [customerId, setCustomerId] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<"login.error" | "login.tooMany" | null>(null);

  async function submit(event: React.FormEvent): Promise<void> {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api("/api/auth/login", { method: "POST", json: { customerId, password } });
      router.replace("/dashboard");
    } catch (failure) {
      setError(
        failure instanceof ApiError && failure.status === 429 ? "login.tooMany" : "login.error",
      );
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-5 py-8">
      <LanguagePicker compact />

      <header className="flex flex-col items-center gap-3 pt-4 text-center">
        <Logo className="size-16" />
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t("login.title")}</h1>
          <p className="mt-1 text-sm text-muted">{t("login.subtitle")}</p>
        </div>
      </header>

      <form onSubmit={(event) => void submit(event)} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="customer-id" className="text-sm font-medium">
            {t("login.customerId")}
          </label>
          <input
            id="customer-id"
            value={customerId}
            onChange={(event) => setCustomerId(event.target.value)}
            placeholder={t("login.customerIdHint")}
            autoComplete="username"
            autoCapitalize="characters"
            required
            className="rounded-xl border border-border bg-surface px-4 py-3 text-base outline-none focus-visible:ring-2 focus-visible:ring-accent"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="password" className="text-sm font-medium">
            {t("login.password")}
          </label>
          <div className="relative">
            <input
              id="password"
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
              required
              className="w-full rounded-xl border border-border bg-surface py-3 pr-12 pl-4 text-base outline-none focus-visible:ring-2 focus-visible:ring-accent"
            />
            <button
              type="button"
              onClick={() => setShowPassword((shown) => !shown)}
              aria-label={t(showPassword ? "login.hidePassword" : "login.showPassword")}
              aria-pressed={showPassword}
              className="absolute inset-y-0 right-0 flex items-center px-3.5 text-muted"
            >
              {showPassword ? <EyeOffIcon className="size-5" /> : <EyeIcon className="size-5" />}
            </button>
          </div>
        </div>

        {error ? (
          <p role="alert" className="rounded-xl bg-warning-soft px-3 py-2 text-sm text-warning">
            {t(error)}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={busy}
          className="rounded-full bg-primary px-5 py-3.5 text-base font-semibold text-on-primary disabled:opacity-60"
        >
          {t(busy ? "login.submitting" : "login.submit")}
        </button>

        <Link href="/forgot-password" className="text-center text-sm font-medium text-accent">
          {t("login.forgot")}
        </Link>
      </form>

      {demoPassword ? (
        <section className="rounded-2xl border border-border bg-surface p-4">
          <h2 className="text-sm font-semibold">{t("login.demoTitle")}</h2>
          <p className="mt-1 text-xs text-muted">{t("login.demoHint")}</p>
          <ul className="mt-3 flex flex-col gap-2">
            {DEMO_PERSONAS.map((persona) => (
              <li key={persona.customerId}>
                <button
                  type="button"
                  onClick={() => {
                    setCustomerId(persona.customerId);
                    setPassword(demoPassword);
                    setError(null);
                  }}
                  className="flex w-full items-center justify-between rounded-xl border border-border px-3 py-2.5 text-left text-sm"
                >
                  <span className="font-medium">{t(persona.label)}</span>
                  <span className="font-mono text-xs text-muted">{persona.customerId}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <p className="text-center text-xs text-muted">{t("login.notBank")}</p>
    </main>
  );
}
