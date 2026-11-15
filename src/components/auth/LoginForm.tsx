"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { usePreferences } from "@/components/providers/PreferencesProvider";
import { LanguagePicker } from "@/components/settings/LanguagePicker";
import { Logo } from "@/components/ui/icons";
import { PasswordField } from "@/components/ui/PasswordField";
import { useAsyncAction } from "@/components/ui/useAsyncAction";
import { Suggestions, Wizard, WizardChoices, WizardField } from "@/components/ui/Wizard";
import { api } from "@/lib/api-client";
import { isApiError } from "@/lib/async-action";
import {
  DEMO_PERSONAS,
  PERSONA_TYPES,
  type DemoPersona,
  type PersonaType,
} from "@/lib/demo/personas";
import { formatMoney } from "@/lib/i18n/config";
import type { MessageKey } from "@/lib/i18n/translate";

const NAVIGATION_TIMEOUT_MS = 10_000;

/** The sign-in page: a welcome with one button, which opens a two-step sign-in. */
export function LoginForm({ demoPassword }: { demoPassword: string | null }): React.JSX.Element {
  const { t, locale } = usePreferences();
  // In the demo the customer is picked by the kind of story their data tells; "own" types an ID.
  const [kind, setKind] = useState<PersonaType | "own">("steady");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [customerId, setCustomerId] = useState(
    demoPassword ? (DEMO_PERSONAS.steady[0]?.customerId ?? "") : "",
  );
  const [password, setPassword] = useState("");
  // Asked for only when this customer has two-step sign-in on.
  const [needsCode, setNeedsCode] = useState(false);
  const [code, setCode] = useState("");
  const [error, setError] = useState<MessageKey | null>(null);

  const [navigating, setNavigating] = useState(false);
  // The error shows inside the wizard, so no toast.
  const login = useAsyncAction(
    () =>
      api("/api/auth/login", {
        method: "POST",
        json: { customerId, password, code: needsCode ? code : undefined },
      }),
    { errorKey: () => null },
  );

  /** What the list says about a demo customer: age, and for a mortgage the home and the outcome. */
  function describe(persona: DemoPersona): string {
    const parts = [t("login.persona.age", { age: persona.age })];
    if (persona.homePriceCents) {
      parts.push(t("login.persona.home", { price: formatMoney(persona.homePriceCents, locale) }));
    }
    if (persona.declined) parts.push(t(`mortgage.reason.${persona.declined}`));
    return parts.join(" · ");
  }

  async function signIn(): Promise<boolean> {
    setError(null);
    const result = await login.run();
    if (!result.ok) {
      const status = isApiError(result.error) ? result.error.status : 0;
      const reason = isApiError(result.error) ? result.error.code : "";
      if (reason === "totp_required") {
        // The password was right: show the extra step instead of an error.
        setNeedsCode(true);
        return false;
      }
      // A server fault is not the user's mistake: say so instead of blaming the password.
      setError(
        reason === "totp_invalid"
          ? "twoStep.wrongCode"
          : status === 429
            ? "login.tooMany"
            : status === 401
              ? "login.error"
              : "login.unavailable",
      );
      return false;
    }
    setNavigating(true);
    router.replace("/dashboard");
    // Stay pending until the page changes, so the button is not re-enabled mid-navigation.
    // If it never does, give the button back with an error instead of leaving it dead.
    return new Promise<boolean>((resolve) => {
      window.setTimeout(() => {
        setNavigating(false);
        setError("login.unavailable");
        resolve(false);
      }, NAVIGATION_TIMEOUT_MS);
    });
  }

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-8 px-5 pt-[calc(var(--safe-top)+2rem)] pb-[calc(env(safe-area-inset-bottom)+2rem)]">
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
        <p className="text-center text-sm text-muted">{t("login.notBank")}</p>
      </div>

      <Wizard
        open={open}
        title={t("login.title")}
        finishLabel={navigating ? t("login.submitting") : t("login.submit")}
        error={error ? t(error) : null}
        onClose={() => {
          setOpen(false);
          setError(null);
        }}
        onFinish={signIn}
        steps={[
          ...(demoPassword
            ? [
                {
                  title: t("login.step.type"),
                  hint: t("login.step.typeHint"),
                  valid: true,
                  content: (
                    <WizardChoices
                      name="customer-type"
                      value={kind}
                      onChange={(next: PersonaType | "own") => {
                        setKind(next);
                        // Start on the first customer of the kind, so Next always has one chosen.
                        setCustomerId(
                          next === "own" ? "" : (DEMO_PERSONAS[next][0]?.customerId ?? ""),
                        );
                      }}
                      options={[
                        ...PERSONA_TYPES.map((type) => ({
                          value: type,
                          label: t(`login.type.${type}`),
                          note: t(`login.type.${type}.note`),
                        })),
                        {
                          value: "own" as const,
                          label: t("login.type.own"),
                          note: t("login.type.own.note"),
                        },
                      ]}
                    />
                  ),
                },
              ]
            : []),
          demoPassword && kind !== "own"
            ? {
                title: t("login.step.pick"),
                hint: t("login.step.pickHint", { type: t(`login.type.${kind}`) }),
                valid: customerId.trim().length > 0,
                content: (
                  <WizardChoices
                    name="customer"
                    value={customerId}
                    onChange={setCustomerId}
                    options={DEMO_PERSONAS[kind].map((persona) => ({
                      value: persona.customerId,
                      label: persona.customerId,
                      note: describe(persona),
                    }))}
                  />
                ),
              }
            : {
                title: t("login.step.id"),
                hint: t("login.step.idHint"),
                valid: customerId.trim().length > 0,
                content: (
                  <WizardField
                    label={t("login.customerId")}
                    value={customerId}
                    onChange={(event) => setCustomerId(event.target.value)}
                    placeholder={t("login.customerIdHint")}
                    autoComplete="username"
                    autoCapitalize="characters"
                    autoFocus
                  />
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
