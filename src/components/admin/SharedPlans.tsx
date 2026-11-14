"use client";

import { useEffect, useState } from "react";

import { adminCall } from "@/components/admin/admin-api";
import { Bars, Panel, Stat } from "@/components/admin/parts";
import { usePreferences } from "@/components/providers/PreferencesProvider";
import { useToast } from "@/components/providers/ToastProvider";
import type { MessageKey } from "@/lib/i18n/translate";

const SLICES = ["bills", "essentials", "everyday", "saving", "investing"] as const;

interface SharedPlan {
  code: string;
  name: string;
  split: Record<(typeof SLICES)[number], number>;
  listed: boolean;
  copies: number;
}

type Result = { plans: SharedPlan[] };

/**
 * Plans customers have shared. Staff see exactly what other customers can
 * see (a name and percentages) and can stop one being shared, for example
 * because of its name.
 */
export function SharedPlans(): React.JSX.Element {
  const { t } = usePreferences();
  const toast = useToast();
  const [plans, setPlans] = useState<SharedPlan[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void adminCall<Result>("/api/admin/plans").then((result) => {
      if (cancelled) return;
      if (result) setPlans(result.plans);
      else setFailed(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  async function remove(code: string): Promise<void> {
    const result = await adminCall<Result>("/api/admin/plans", "DELETE", { code });
    if (!result) {
      toast.fail();
      return;
    }
    setPlans(result.plans);
    toast.notify("toast.updated");
  }

  const all = plans ?? [];
  const average = (key: (typeof SLICES)[number]): number =>
    all.length === 0
      ? 0
      : Math.round(all.reduce((sum, plan) => sum + plan.split[key], 0) / all.length);

  return (
    <>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label={t("admin.plans.shared")} value={String(all.length)} />
        <Stat
          label={t("admin.plans.listed")}
          value={String(all.filter((plan) => plan.listed).length)}
        />
        <Stat
          label={t("admin.plans.copies")}
          value={String(all.reduce((sum, plan) => sum + plan.copies, 0))}
        />
      </div>
      <div className="grid gap-5 md:grid-cols-2">
        <Panel title={t("admin.plans.average")}>
          <Bars
            share={false}
            rows={SLICES.map((key) => ({
              label: t(`plan.slice.${key}` as MessageKey),
              count: average(key),
              note: `${average(key)} %`,
            }))}
          />
          <p className="text-xs text-muted">{t("admin.plans.average.note")}</p>
        </Panel>
        <Panel title={t("admin.plans.top")}>
          <Bars
            share={false}
            rows={[...all]
              .sort((a, b) => b.copies - a.copies)
              .slice(0, 6)
              .map((plan) => ({ label: `${plan.name} (${plan.code})`, count: plan.copies }))}
          />
        </Panel>
      </div>
      <Panel title={t("admin.nav.plans")}>
        {failed ? <p className="text-sm text-warning">{t("admin.loadFailed")}</p> : null}
        {plans && plans.length === 0 ? (
          <p className="text-sm text-muted">{t("admin.plans.empty")}</p>
        ) : null}
        <ul className="flex flex-col gap-2">
          {all.map((plan) => (
            <li
              key={plan.code}
              className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-xl border border-border px-4 py-3 text-sm"
            >
              <span className="min-w-0">
                <span className="font-semibold">{plan.name}</span>
                <span className="text-muted">
                  {" · "}
                  {t(plan.listed ? "admin.plans.isListed" : "admin.plans.codeOnly")}
                  {" · "}
                  {t("plans.copies", { count: plan.copies })}
                </span>
                <span className="block text-muted tabular-nums">
                  {SLICES.map(
                    (key) => `${t(`plan.slice.${key}` as MessageKey)} ${plan.split[key]} %`,
                  ).join(" · ")}
                </span>
              </span>
              <button
                type="button"
                className="font-semibold text-warning"
                onClick={() => void remove(plan.code)}
              >
                {t("admin.plans.remove")}
              </button>
            </li>
          ))}
        </ul>
        <p className="text-xs text-muted">{t("admin.plans.note")}</p>
      </Panel>
    </>
  );
}
