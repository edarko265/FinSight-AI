"use client";

import { useEffect, useState } from "react";

import { usePreferences } from "@/components/providers/PreferencesProvider";
import { useToast } from "@/components/providers/ToastProvider";
import { Wizard, WizardField } from "@/components/ui/Wizard";
import { api, ApiError } from "@/lib/api-client";
import type { MessageKey } from "@/lib/i18n/translate";

/**
 * Two-step sign-in: a six-digit code from an authenticator app after the
 * password. Used for customers (Settings) and for staff (the admin area); the
 * only difference is the address it talks to.
 */
export function TwoStep({ endpoint }: { endpoint: string }): React.JSX.Element | null {
  const { t } = usePreferences();
  const toast = useToast();
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [owner, setOwner] = useState(false);
  const [mode, setMode] = useState<"on" | "off" | null>(null);
  const [setup, setSetup] = useState<{ secret: string; qr: string } | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState<MessageKey | null>(null);

  useEffect(() => {
    let cancelled = false;
    api<{ enabled: boolean; owner?: boolean }>(endpoint)
      .then((data) => {
        if (cancelled) return;
        setEnabled(data.enabled);
        setOwner(Boolean(data.owner));
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [endpoint]);

  function close(): void {
    setMode(null);
    setSetup(null);
    setCode("");
    setError(null);
  }

  async function begin(): Promise<void> {
    setError(null);
    try {
      setSetup(
        await api<{ secret: string; qr: string }>(endpoint, {
          method: "POST",
          json: { action: "begin" },
        }),
      );
      setMode("on");
    } catch {
      toast.fail();
    }
  }

  async function finish(): Promise<boolean> {
    setError(null);
    try {
      const result = await api<{ enabled: boolean }>(endpoint, {
        method: "POST",
        json: { action: mode === "on" ? "confirm" : "disable", code },
      });
      setEnabled(result.enabled);
      toast.notify(result.enabled ? "twoStep.turnedOn" : "twoStep.turnedOff");
      close();
      return true;
    } catch (failure) {
      setError(
        failure instanceof ApiError && failure.code === "wrong_code"
          ? "twoStep.wrongCode"
          : "toast.error",
      );
      return false;
    }
  }

  if (enabled === null || owner) return null;
  const codeStep = {
    title: t("twoStep.code"),
    hint: t(mode === "on" ? "twoStep.codeHint" : "twoStep.offHint"),
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
  };

  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-surface px-4 py-3 text-sm">
      <span>
        <span className="block font-semibold">{t("twoStep.title")}</span>
        <span className="block text-muted">{t(enabled ? "twoStep.on" : "twoStep.off")}</span>
      </span>
      <button
        type="button"
        className="shrink-0 font-semibold text-accent"
        onClick={() => (enabled ? setMode("off") : void begin())}
      >
        {t(enabled ? "twoStep.turnOff" : "twoStep.turnOn")}
      </button>

      <Wizard
        open={mode !== null}
        title={t("twoStep.title")}
        finishLabel={t(mode === "on" ? "twoStep.turnOn" : "twoStep.turnOff")}
        error={error ? t(error) : null}
        onClose={close}
        onFinish={finish}
        steps={
          mode === "on"
            ? [
                {
                  title: t("twoStep.scan"),
                  hint: t("twoStep.scanHint"),
                  valid: setup !== null,
                  content: setup ? (
                    <div className="flex flex-col items-center gap-3">
                      {/* eslint-disable-next-line @next/next/no-img-element -- a generated QR code, not a hosted image */}
                      <img
                        src={setup.qr}
                        alt={t("twoStep.qrAlt")}
                        width={220}
                        height={220}
                        className="rounded-xl bg-white p-2"
                      />
                      <p className="text-center text-xs text-muted">{t("twoStep.manual")}</p>
                      <p className="font-mono text-sm tracking-widest break-all select-all">
                        {setup.secret}
                      </p>
                    </div>
                  ) : null,
                },
                codeStep,
              ]
            : [codeStep]
        }
      />
    </div>
  );
}
