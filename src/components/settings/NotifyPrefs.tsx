"use client";

import { useEffect, useState } from "react";

import { usePreferences } from "@/components/providers/PreferencesProvider";
import { useToast } from "@/components/providers/ToastProvider";
import { Wizard, WizardChoices, WizardReview } from "@/components/ui/Wizard";
import { api } from "@/lib/api-client";
import type { MessageKey } from "@/lib/i18n/translate";

interface Prefs {
  types: Record<string, boolean>;
  quiet: { from: number; to: number } | null;
}

const HOURS = Array.from({ length: 24 }, (_, hour) => hour);
const clock = (hour: number): string => `${String(hour).padStart(2, "0")}:00`;

/** What to be notified about on the device, and the hours to stay quiet. */
export function NotifyPrefs(): React.JSX.Element | null {
  const { t } = usePreferences();
  const toast = useToast();
  const [prefs, setPrefs] = useState<Prefs | null>(null);
  const [types, setTypes] = useState<string[]>([]);
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"on" | "off">("on");
  const [from, setFrom] = useState(21);
  const [to, setTo] = useState(8);

  useEffect(() => {
    let cancelled = false;
    api<{ prefs: Prefs; types: string[] }>("/api/notifications/prefs")
      .then((data) => {
        if (cancelled) return;
        setPrefs(data.prefs);
        setTypes(data.types);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  async function save(next: Prefs): Promise<boolean> {
    const before = prefs;
    setPrefs(next);
    try {
      await api("/api/notifications/prefs", { method: "PUT", json: next });
      toast.notify("toast.saved");
      return true;
    } catch {
      setPrefs(before);
      toast.fail();
      return false;
    }
  }

  if (!prefs) return null;
  return (
    <div className="flex flex-col gap-2 rounded-2xl border border-border bg-surface px-4 py-3 text-sm">
      <p className="font-semibold">{t("notify.prefs.title")}</p>
      <ul className="flex flex-col">
        {types.map((type) => (
          <li key={type}>
            <label className="flex items-center justify-between gap-3 py-1.5">
              <span>{t(`notify.type.${type}` as MessageKey)}</span>
              <input
                type="checkbox"
                checked={prefs.types[type] ?? true}
                onChange={(event) =>
                  void save({ ...prefs, types: { ...prefs.types, [type]: event.target.checked } })
                }
                className="size-5 shrink-0 accent-(--accent)"
              />
            </label>
          </li>
        ))}
      </ul>
      <div className="flex items-center justify-between gap-3 border-t border-border pt-2">
        <span>
          <span className="block font-semibold">{t("notify.quiet.title")}</span>
          <span className="block text-muted">
            {prefs.quiet
              ? t("notify.quiet.value", {
                  from: clock(prefs.quiet.from),
                  to: clock(prefs.quiet.to),
                })
              : t("notify.quiet.none")}
          </span>
        </span>
        <button
          type="button"
          className="shrink-0 font-semibold text-accent"
          onClick={() => {
            setMode(prefs.quiet ? "on" : "off");
            setFrom(prefs.quiet?.from ?? 21);
            setTo(prefs.quiet?.to ?? 8);
            setOpen(true);
          }}
        >
          {t("common.edit")}
        </button>
      </div>
      <p className="text-xs text-muted">{t("notify.prefs.note")}</p>

      <Wizard
        open={open}
        title={t("notify.quiet.title")}
        finishLabel={t("common.save")}
        onClose={() => setOpen(false)}
        onFinish={async () => {
          const done = await save({ ...prefs, quiet: mode === "on" ? { from, to } : null });
          if (done) setOpen(false);
          return done;
        }}
        steps={[
          {
            title: t("notify.quiet.step"),
            hint: t("notify.quiet.stepHint"),
            valid: true,
            content: (
              <WizardChoices
                name="quiet-mode"
                value={mode}
                onChange={setMode}
                options={[
                  { value: "on", label: t("notify.quiet.on"), note: t("notify.quiet.on.note") },
                  { value: "off", label: t("notify.quiet.off"), note: t("notify.quiet.off.note") },
                ]}
              />
            ),
          },
          ...(mode === "on"
            ? [
                {
                  title: t("notify.quiet.hours"),
                  hint: t("notify.quiet.hoursHint"),
                  valid: from !== to,
                  content: (
                    <div className="grid grid-cols-2 gap-3">
                      {(
                        [
                          ["notify.quiet.from", from, setFrom],
                          ["notify.quiet.to", to, setTo],
                        ] as const
                      ).map(([key, value, set]) => (
                        <label key={key} className="flex flex-col gap-1.5 text-sm font-medium">
                          {t(key)}
                          <select
                            value={value}
                            onChange={(event) => set(Number(event.target.value))}
                            className="rounded-xl border border-border bg-surface px-4 py-3 text-base font-normal"
                          >
                            {HOURS.map((hour) => (
                              <option key={hour} value={hour}>
                                {clock(hour)}
                              </option>
                            ))}
                          </select>
                        </label>
                      ))}
                    </div>
                  ),
                },
              ]
            : []),
          {
            title: t("wizard.review"),
            hint: t("wizard.reviewHint"),
            valid: mode === "off" || from !== to,
            content: (
              <WizardReview
                rows={[
                  {
                    label: t("notify.quiet.title"),
                    value:
                      mode === "on"
                        ? t("notify.quiet.value", { from: clock(from), to: clock(to) })
                        : t("notify.quiet.none"),
                  },
                ]}
              />
            ),
          },
        ]}
      />
    </div>
  );
}
