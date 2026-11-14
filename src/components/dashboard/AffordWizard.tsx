"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { usePreferences } from "@/components/providers/PreferencesProvider";
import { Suggestions, Wizard, WizardChoices, WizardField } from "@/components/ui/Wizard";
import { formatMoney } from "@/lib/i18n/config";
import type { MessageKey } from "@/lib/i18n/translate";

const PRICES = [50, 150, 300, 600];
const SPANS = ["7", "14", "30"] as const;

/** "Can I afford this?": asks the coach to test a purchase against the safe-to-spend estimate. */
export function AffordWizard({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}): React.JSX.Element {
  const { t, locale } = usePreferences();
  const router = useRouter();
  const [price, setPrice] = useState("");
  const [days, setDays] = useState<(typeof SPANS)[number]>("7");
  const euros = Number(price.replace(",", "."));
  const valid = price.trim() !== "" && Number.isFinite(euros) && euros > 0 && euros <= 1_000_000;

  return (
    <Wizard
      open={open}
      title={t("afford.cta")}
      finishLabel={t("afford.check")}
      onClose={onClose}
      onFinish={() => {
        const question = t("afford.question", {
          amount: String(Math.round(euros * 100) / 100),
          days,
        });
        onClose();
        router.push(`/chat?q=${encodeURIComponent(question)}`);
      }}
      steps={[
        {
          title: t("afford.step.amount"),
          hint: t("afford.step.amountHint"),
          valid,
          content: (
            <>
              <WizardField
                label={t("afford.field")}
                value={price}
                onChange={(event) => setPrice(event.target.value)}
                placeholder="300"
                inputMode="decimal"
                autoFocus
              />
              <Suggestions
                label={t("wizard.suggestions")}
                options={PRICES.map((amount) => ({
                  label: formatMoney(amount * 100, locale),
                  value: String(amount),
                }))}
                onPick={setPrice}
              />
            </>
          ),
        },
        {
          title: t("afford.step.when"),
          hint: t("afford.step.whenHint"),
          valid,
          content: (
            <WizardChoices
              name="afford-days"
              value={days}
              onChange={setDays}
              options={SPANS.map((span) => ({
                value: span,
                label: t(`afford.days.${span}` as MessageKey),
              }))}
            />
          ),
        },
      ]}
    />
  );
}
