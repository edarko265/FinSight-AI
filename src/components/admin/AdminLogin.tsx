"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { usePreferences } from "@/components/providers/PreferencesProvider";
import { LanguagePicker } from "@/components/settings/LanguagePicker";
import { EyeIcon, EyeOffIcon, Logo } from "@/components/ui/icons";
import { api, ApiError } from "@/lib/api-client";

export function AdminLogin(): React.JSX.Element {
  const { t } = usePreferences();
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState<"login.error" | "login.tooMany" | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent): Promise<void> {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api("/api/admin/login", { method: "POST", json: { password } });
      router.replace("/admin");
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
      <header className="flex flex-col items-center gap-3 pt-6 text-center">
        <Logo className="size-14" />
        <h1 className="text-2xl font-semibold tracking-tight">{t("admin.login.title")}</h1>
        <p className="text-sm text-muted">{t("admin.login.hint")}</p>
      </header>
      <form onSubmit={(event) => void submit(event)} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="admin-password" className="text-sm font-medium">
            {t("login.password")}
          </label>
          <div className="relative">
            <input
              id="admin-password"
              type={show ? "text" : "password"}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
              required
              className="w-full rounded-xl border border-border bg-surface py-3 pr-12 pl-4 text-base outline-none focus-visible:ring-2 focus-visible:ring-accent"
            />
            <button
              type="button"
              onClick={() => setShow((shown) => !shown)}
              aria-label={t(show ? "login.hidePassword" : "login.showPassword")}
              aria-pressed={show}
              className="absolute inset-y-0 right-0 flex items-center px-3.5 text-muted"
            >
              {show ? <EyeOffIcon className="size-5" /> : <EyeIcon className="size-5" />}
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
      </form>
    </main>
  );
}
