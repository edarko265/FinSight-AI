"use client";

import { useState } from "react";

import { assertSignedIn } from "@/components/admin/admin-api";
import { usePreferences } from "@/components/providers/PreferencesProvider";
import { useToast } from "@/components/providers/ToastProvider";
import { useAsyncAction } from "@/components/ui/useAsyncAction";
import {
  Suggestions,
  Wizard,
  WizardChoices,
  WizardField,
  WizardReview,
} from "@/components/ui/Wizard";
import { formatMoney } from "@/lib/i18n/config";
import type { MessageKey } from "@/lib/i18n/translate";

export type ProviderChoice = "auto" | "openai" | "gemini";

export interface AppSettings {
  aiProvider: ProviderChoice;
  features: { ai: boolean; voice: boolean; rewards: boolean; advisor: boolean; sharing: boolean };
  advisorFeeCents: number;
  aiDailyRequestLimit: number;
  rewards: {
    points: Record<
      "under_average" | "choice_down" | "buffer" | "surplus_streak" | "investing" | "goal",
      number
    >;
  };
}

const FLAGS = ["ai", "voice", "rewards", "advisor", "sharing"] as const;
const RULES = [
  "under_average",
  "choice_down",
  "buffer",
  "surplus_streak",
  "investing",
  "goal",
] as const;
type Editing = "fee" | "limit" | "rules" | "provider" | null;

/** What staff can change without a deploy: feature switches, the adviser fee, the AI budget and reward rules. */
export function AdminControls({
  settings,
  requestsToday,
  model,
  providers,
  onSaved,
}: {
  settings: AppSettings;
  requestsToday: number;
  /** The model answering right now, or null when AI is off. */
  model: string | null;
  /** Providers that have a key configured. */
  providers: string[];
  onSaved: (next: AppSettings) => void;
}): React.JSX.Element {
  const { t, locale } = usePreferences();
  const toast = useToast();
  const [editing, setEditing] = useState<Editing>(null);
  const [fee, setFee] = useState("");
  const [limit, setLimit] = useState("");
  const [rules, setRules] = useState(settings.rewards);
  const [provider, setProvider] = useState<ProviderChoice>(settings.aiProvider);

  const saver = useAsyncAction(
    async (next: AppSettings): Promise<void> => {
      const response = await fetch("/api/admin/settings", {
        method: "PUT",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(next),
      });
      assertSignedIn(response);
      if (!response.ok) throw new Error("settings failed");
      onSaved(((await response.json()) as { settings: AppSettings }).settings);
      setEditing(null);
    },
    { successKey: "toast.updated", errorKey: "common.saveFailed" },
  );

  /** True when saved; false keeps a wizard open on its last step. */
  async function save(next: AppSettings): Promise<boolean> {
    const result = await saver.run(next);
    // A run dropped because a save is still pending says nothing by itself, so say so.
    if (!result.ok && result.dropped) toast.fail("common.saveFailed");
    return result.ok;
  }

  const feeEuros = Number(fee.replace(",", "."));
  const feeOk = fee.trim() !== "" && Number.isFinite(feeEuros) && feeEuros >= 0 && feeEuros <= 1000;
  const limitNumber = Math.round(Number(limit));
  const limitOk =
    limit.trim() !== "" &&
    Number.isFinite(limitNumber) &&
    limitNumber >= 0 &&
    limitNumber <= 1_000_000;
  const numberField = (
    value: number,
    onChange: (next: number) => void,
    label: string,
  ): React.JSX.Element => (
    <WizardField
      key={label}
      label={label}
      value={String(value)}
      inputMode="numeric"
      onChange={(event) =>
        onChange(Math.min(1000, Math.max(0, Math.round(Number(event.target.value)) || 0)))
      }
    />
  );

  const row =
    "flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border px-4 py-3 text-sm";
  const link = "shrink-0 font-semibold text-accent";

  return (
    <div className="flex flex-col gap-3">
      <ul className="grid gap-2 md:grid-cols-2">
        {FLAGS.map((flag) => (
          <li key={flag}>
            <label className={row}>
              <span className="flex min-w-0 flex-col">
                <span className="font-semibold">{t(`admin.flag.${flag}` as MessageKey)}</span>
                <span className="text-xs text-muted">
                  {t(`admin.flag.${flag}.note` as MessageKey)}
                </span>
              </span>
              <input
                type="checkbox"
                checked={settings.features[flag]}
                aria-disabled={saver.pending}
                onChange={(event) =>
                  !saver.pending &&
                  void save({
                    ...settings,
                    features: { ...settings.features, [flag]: event.target.checked },
                  })
                }
                className="size-5 shrink-0 accent-(--accent) aria-disabled:opacity-60"
              />
            </label>
          </li>
        ))}
      </ul>

      <div className={row}>
        <span className="flex flex-col">
          <span className="font-semibold">{t("admin.provider")}</span>
          <span className="text-xs text-muted">
            {model ? t("admin.provider.current", { model }) : t("admin.ai.off")}
          </span>
        </span>
        <button
          type="button"
          onClick={() => {
            setProvider(settings.aiProvider);
            setEditing("provider");
          }}
          className={link}
        >
          {t("admin.provider.change")}
        </button>
      </div>

      <div className={row}>
        <span className="flex flex-col">
          <span className="font-semibold">{t("admin.fee")}</span>
          <span className="text-xs text-muted">
            {t("admin.fee.value", { fee: formatMoney(settings.advisorFeeCents, locale) })}
          </span>
        </span>
        <button
          type="button"
          onClick={() => {
            setFee(String(settings.advisorFeeCents / 100));
            setEditing("fee");
          }}
          className={link}
        >
          {t("admin.fee.change")}
        </button>
      </div>

      <div className={row}>
        <span className="flex flex-col">
          <span className="font-semibold">{t("admin.aiLimit")}</span>
          <span className="text-xs text-muted">
            {settings.aiDailyRequestLimit > 0
              ? t("admin.aiLimit.value", {
                  used: requestsToday,
                  limit: settings.aiDailyRequestLimit,
                })
              : t("admin.aiLimit.none", { used: requestsToday })}
          </span>
        </span>
        <button
          type="button"
          onClick={() => {
            setLimit(String(settings.aiDailyRequestLimit));
            setEditing("limit");
          }}
          className={link}
        >
          {t("admin.aiLimit.change")}
        </button>
      </div>

      <div className={row}>
        <span className="flex flex-col">
          <span className="font-semibold">{t("admin.rules")}</span>
          <span className="text-xs text-muted">
            {t("admin.rules.summary", {
              count: RULES.length,
            })}
          </span>
        </span>
        <button
          type="button"
          onClick={() => {
            setRules(settings.rewards);
            setEditing("rules");
          }}
          className={link}
        >
          {t("admin.rules.change")}
        </button>
      </div>

      <Wizard
        open={editing === "provider"}
        title={t("admin.provider")}
        finishLabel={t("common.save")}
        onClose={() => setEditing(null)}
        onFinish={() => save({ ...settings, aiProvider: provider })}
        steps={[
          {
            title: t("admin.provider.step"),
            hint: t("admin.provider.stepHint"),
            valid: provider === "auto" || providers.includes(provider),
            content: (
              <WizardChoices
                name="ai-provider"
                value={provider}
                onChange={setProvider}
                options={[
                  {
                    value: "auto" as const,
                    label: t("admin.provider.auto"),
                    note: t("admin.provider.autoNote"),
                  },
                  ...(["openai", "gemini"] as const).map((name) => ({
                    value: name,
                    label: t(`admin.provider.${name}` as MessageKey),
                    note: t(
                      providers.includes(name) ? "admin.provider.ready" : "admin.provider.noKey",
                    ),
                  })),
                ]}
              />
            ),
          },
          {
            title: t("wizard.review"),
            hint: t("wizard.reviewHint"),
            valid: provider === "auto" || providers.includes(provider),
            content: (
              <WizardReview
                rows={[
                  {
                    label: t("admin.provider"),
                    value: t(`admin.provider.${provider}` as MessageKey),
                  },
                ]}
              />
            ),
          },
        ]}
      />

      <Wizard
        open={editing === "fee"}
        title={t("admin.fee")}
        finishLabel={t("common.save")}
        onClose={() => setEditing(null)}
        onFinish={() => save({ ...settings, advisorFeeCents: Math.round(feeEuros * 100) })}
        steps={[
          {
            title: t("admin.fee.step"),
            hint: t("admin.fee.stepHint"),
            valid: feeOk,
            content: (
              <>
                <WizardField
                  label={t("admin.fee.field")}
                  value={fee}
                  onChange={(event) => setFee(event.target.value)}
                  placeholder="19"
                  inputMode="decimal"
                  autoFocus
                />
                <Suggestions
                  label={t("wizard.suggestions")}
                  options={[0, 9, 19, 29, 49].map((euros) => ({
                    label: formatMoney(euros * 100, locale),
                    value: String(euros),
                  }))}
                  onPick={setFee}
                />
              </>
            ),
          },
          {
            title: t("wizard.review"),
            hint: t("wizard.reviewHint"),
            valid: feeOk,
            content: (
              <WizardReview
                rows={[
                  {
                    label: t("admin.fee"),
                    value: feeOk ? formatMoney(Math.round(feeEuros * 100), locale) : "—",
                  },
                ]}
              />
            ),
          },
        ]}
      />

      <Wizard
        open={editing === "limit"}
        title={t("admin.aiLimit")}
        finishLabel={t("common.save")}
        onClose={() => setEditing(null)}
        onFinish={() => save({ ...settings, aiDailyRequestLimit: limitNumber })}
        steps={[
          {
            title: t("admin.aiLimit.step"),
            hint: t("admin.aiLimit.stepHint"),
            valid: limitOk,
            content: (
              <>
                <WizardField
                  label={t("admin.aiLimit.field")}
                  value={limit}
                  onChange={(event) => setLimit(event.target.value)}
                  placeholder="2000"
                  inputMode="numeric"
                  autoFocus
                />
                <Suggestions
                  label={t("wizard.suggestions")}
                  options={[0, 500, 2000, 10000].map((count) => ({
                    label: String(count),
                    value: String(count),
                  }))}
                  onPick={setLimit}
                />
              </>
            ),
          },
          {
            title: t("wizard.review"),
            hint: t("wizard.reviewHint"),
            valid: limitOk,
            content: (
              <WizardReview
                rows={[
                  { label: t("admin.aiLimit.field"), value: limitOk ? String(limitNumber) : "—" },
                ]}
              />
            ),
          },
        ]}
      />

      <Wizard
        open={editing === "rules"}
        title={t("admin.rules")}
        finishLabel={t("common.save")}
        onClose={() => setEditing(null)}
        onFinish={() => save({ ...settings, rewards: rules })}
        steps={[
          {
            title: t("admin.rules.points"),
            hint: t("admin.rules.pointsHint"),
            valid: true,
            content: (
              <div className="flex flex-col gap-3">
                {RULES.map((rule) =>
                  numberField(
                    rules.points[rule],
                    (next) => setRules({ ...rules, points: { ...rules.points, [rule]: next } }),
                    t(`admin.rule.${rule}` as MessageKey),
                  ),
                )}
              </div>
            ),
          },
          {
            title: t("wizard.review"),
            hint: t("wizard.reviewHint"),
            valid: true,
            content: (
              <WizardReview
                rows={[
                  ...RULES.map((rule) => ({
                    label: t(`admin.rule.${rule}` as MessageKey),
                    value: String(rules.points[rule]),
                  })),
                ]}
              />
            ),
          },
        ]}
      />
    </div>
  );
}
