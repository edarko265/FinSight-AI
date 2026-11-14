"use client";

import { useState } from "react";

import { usePreferences } from "@/components/providers/PreferencesProvider";
import { useToast } from "@/components/providers/ToastProvider";
import { PendingLabel } from "@/components/ui/Spinner";
import { useAsyncAction } from "@/components/ui/useAsyncAction";
import { Wizard, WizardChoices, WizardReview } from "@/components/ui/Wizard";
import { api } from "@/lib/api-client";
import { hasMessage, type MessageKey } from "@/lib/i18n/translate";

export interface CorrectionTarget {
  key: string;
  kindKey: string;
  category: string;
  basket: string;
  necessity: string;
  originalBasket: string;
  originalNecessity: string;
  corrected: boolean;
}

type Basket = "regular" | "irregular" | "everyday";
type Necessity = "essential" | "discretionary";
const BASKETS: Basket[] = ["regular", "irregular", "everyday"];
const NECESSITIES: Necessity[] = ["essential", "discretionary"];

/**
 * Lets the customer say which basket a purchase really belongs to, for that
 * one purchase or for every purchase of its kind. What the rules said stays
 * on record and can be put back with one tap.
 */
export function CorrectionWizard({
  target,
  onClose,
  onDone,
}: {
  target: CorrectionTarget | null;
  onClose: () => void;
  onDone: () => void;
}): React.JSX.Element {
  const { t } = usePreferences();
  const toast = useToast();
  const [basket, setBasket] = useState<Basket | null>(null);
  const [necessity, setNecessity] = useState<Necessity | null>(null);
  const [scope, setScope] = useState<"transaction" | "kind">("transaction");

  const asBasket = (value: string): Basket =>
    (BASKETS as string[]).includes(value) ? (value as Basket) : "everyday";
  const asNecessity = (value: string): Necessity =>
    value === "essential" ? "essential" : "discretionary";
  const chosenBasket = basket ?? asBasket(target?.basket ?? "everyday");
  const chosenNecessity = necessity ?? asNecessity(target?.necessity ?? "discretionary");
  const label = (prefix: string, value: string): string =>
    hasMessage(`${prefix}.${value}`) ? t(`${prefix}.${value}` as MessageKey) : value;

  function close(): void {
    setBasket(null);
    setNecessity(null);
    setScope("transaction");
    onClose();
  }

  async function send(payload: Record<string, unknown>, message: MessageKey): Promise<boolean> {
    try {
      await api("/api/corrections", { method: "POST", json: payload });
    } catch {
      toast.fail();
      return false;
    }
    toast.notify(message);
    close();
    onDone();
    return true;
  }

  // A correction made for the whole kind is undone together with the transaction's own.
  const undo = useAsyncAction(
    async (current: CorrectionTarget) => {
      await api("/api/corrections", {
        method: "POST",
        json: { action: "undo", scope: "transaction", key: current.key },
      });
      await api("/api/corrections", {
        method: "POST",
        json: { action: "undo", scope: "kind", key: current.kindKey },
      });
    },
    { successKey: "toast.restored" },
  );

  async function undoCorrection(current: CorrectionTarget): Promise<void> {
    const result = await undo.run(current);
    if (!result.ok) return;
    close();
    onDone();
  }

  return (
    <Wizard
      open={target !== null}
      title={t("corrections.change")}
      finishLabel={t("common.save")}
      onClose={close}
      onFinish={() =>
        send(
          {
            action: "basket",
            scope,
            key: scope === "kind" ? target?.kindKey : target?.key,
            basket: chosenBasket,
            necessity: chosenNecessity,
          },
          "toast.updated",
        )
      }
      steps={[
        {
          title: t("corrections.step.basket"),
          hint: t("corrections.step.basketHint", {
            basket: label("basket", target?.originalBasket ?? ""),
          }),
          valid: true,
          content: (
            <>
              <WizardChoices
                name="correction-basket"
                value={chosenBasket}
                onChange={setBasket}
                options={BASKETS.map((value) => ({
                  value,
                  label: label("basket", value),
                  note: t(`corrections.basket.${value}` as MessageKey),
                }))}
              />
              {target?.corrected ? (
                <button
                  type="button"
                  className="self-start text-sm font-semibold text-accent"
                  aria-disabled={undo.pending}
                  onClick={() => void undoCorrection(target)}
                >
                  {undo.pending ? (
                    <PendingLabel>{t("common.restoring")}</PendingLabel>
                  ) : (
                    t("corrections.undo")
                  )}
                </button>
              ) : null}
            </>
          ),
        },
        {
          title: t("corrections.step.necessity"),
          hint: t("corrections.step.necessityHint"),
          valid: true,
          content: (
            <WizardChoices
              name="correction-necessity"
              value={chosenNecessity}
              onChange={setNecessity}
              options={NECESSITIES.map((value) => ({
                value,
                label: label("necessity", value),
                note: t(`corrections.necessity.${value}` as MessageKey),
              }))}
            />
          ),
        },
        {
          title: t("corrections.step.scope"),
          hint: t("corrections.step.scopeHint"),
          valid: true,
          content: (
            <WizardChoices
              name="correction-scope"
              value={scope}
              onChange={setScope}
              options={[
                {
                  value: "transaction",
                  label: t("corrections.scope.one"),
                  note: t("corrections.scope.one.note"),
                },
                {
                  value: "kind",
                  label: t("corrections.scope.kind", {
                    category: label("cat", target?.category ?? ""),
                  }),
                  note: t("corrections.scope.kind.note"),
                },
              ]}
            />
          ),
        },
        {
          title: t("wizard.review"),
          hint: t("corrections.reviewHint"),
          valid: true,
          content: (
            <WizardReview
              rows={[
                {
                  label: t("corrections.was"),
                  value: `${label("basket", target?.originalBasket ?? "")} · ${label("necessity", target?.originalNecessity ?? "")}`,
                },
                {
                  label: t("corrections.now"),
                  value: `${label("basket", chosenBasket)} · ${label("necessity", chosenNecessity)}`,
                },
                {
                  label: t("corrections.step.scope"),
                  value:
                    scope === "kind"
                      ? t("corrections.scope.kind", {
                          category: label("cat", target?.category ?? ""),
                        })
                      : t("corrections.scope.one"),
                },
              ]}
            />
          ),
        },
      ]}
    />
  );
}
