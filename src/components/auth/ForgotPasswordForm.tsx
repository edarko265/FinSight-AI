"use client";

import Link from "next/link";
import { useState } from "react";

import { usePreferences } from "@/components/providers/PreferencesProvider";
import { Logo } from "@/components/ui/icons";

/**
 * Password reset for the demo. Accounts are the bank's synthetic customers
 * sharing one demo password, so there is nothing to reset and no message is
 * sent; the screen always gives the same answer, whether or not the ID exists.
 */
export function ForgotPasswordForm(): React.JSX.Element {
  const { t } = usePreferences();
  const [customerId, setCustomerId] = useState("");
  const [sent, setSent] = useState(false);

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-5 py-8">
      <header className="flex flex-col items-center gap-3 pt-8 text-center">
        <Logo className="size-14" />
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t("forgot.title")}</h1>
          <p className="mt-1 text-sm text-muted">{t("forgot.subtitle")}</p>
        </div>
      </header>

      {sent ? (
        <p
          role="status"
          className="rounded-2xl border border-border bg-accent-soft px-4 py-3 text-sm"
        >
          {t("forgot.sent")}
        </p>
      ) : (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            setSent(true);
          }}
          className="flex flex-col gap-4"
        >
          <div className="flex flex-col gap-1.5">
            <label htmlFor="reset-customer-id" className="text-sm font-medium">
              {t("login.customerId")}
            </label>
            <input
              id="reset-customer-id"
              value={customerId}
              onChange={(event) => setCustomerId(event.target.value)}
              placeholder={t("login.customerIdHint")}
              autoComplete="username"
              required
              className="rounded-xl border border-border bg-surface px-4 py-3 text-base outline-none focus-visible:ring-2 focus-visible:ring-accent"
            />
          </div>
          <button
            type="submit"
            className="rounded-full bg-primary px-5 py-3.5 text-base font-semibold text-on-primary"
          >
            {t("forgot.submit")}
          </button>
        </form>
      )}

      <Link href="/login" className="text-center text-sm font-medium text-accent">
        {t("forgot.back")}
      </Link>
    </main>
  );
}
