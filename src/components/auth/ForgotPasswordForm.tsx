"use client";

import Link from "next/link";
import { useState } from "react";

import { usePreferences } from "@/components/providers/PreferencesProvider";
import { Logo } from "@/components/ui/icons";
import { Wizard, WizardField } from "@/components/ui/Wizard";

/**
 * Password reset for the demo. Accounts are the bank's synthetic customers
 * sharing one demo password, so there is nothing to reset and no message is
 * sent; the screen always gives the same answer, whether or not the ID exists.
 */
export function ForgotPasswordForm(): React.JSX.Element {
  const { t } = usePreferences();
  const [open, setOpen] = useState(false);
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
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="rounded-full bg-primary px-5 py-3.5 text-base font-semibold text-on-primary"
        >
          {t("forgot.start")}
        </button>
      )}

      <Link href="/login" className="text-center text-sm font-medium text-accent">
        {t("forgot.back")}
      </Link>

      <Wizard
        open={open}
        title={t("forgot.title")}
        finishLabel={t("forgot.submit")}
        onClose={() => setOpen(false)}
        onFinish={() => {
          setSent(true);
          setOpen(false);
        }}
        steps={[
          {
            title: t("forgot.step"),
            hint: t("forgot.stepHint"),
            valid: customerId.trim().length > 0,
            content: (
              <WizardField
                label={t("login.customerId")}
                value={customerId}
                onChange={(event) => setCustomerId(event.target.value)}
                placeholder={t("login.customerIdHint")}
                autoComplete="username"
                autoFocus
              />
            ),
          },
        ]}
      />
    </main>
  );
}
