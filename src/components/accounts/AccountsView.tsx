"use client";

import { useCallback, useEffect, useState } from "react";

import { useOverview } from "@/components/providers/OverviewProvider";
import { usePreferences } from "@/components/providers/PreferencesProvider";
import { useToast } from "@/components/providers/ToastProvider";
import {
  Suggestions,
  Wizard,
  WizardChoices,
  WizardField,
  WizardReview,
} from "@/components/ui/Wizard";
import { api, ApiError } from "@/lib/api-client";
import { formatMoney } from "@/lib/i18n/config";
import type { MessageKey } from "@/lib/i18n/translate";

type Bank = "aurora" | "kaski" | "nordlys";
type Kind = "everyday" | "savings" | "credit";

interface Account {
  id: string;
  bank?: Bank;
  kind: "main" | Kind;
  nickname?: string;
  balanceCents: number;
  included: boolean;
  simulated: boolean;
}

interface Payload {
  banks: Bank[];
  kinds: Kind[];
  accounts: Account[];
}

/**
 * The customer's accounts in one place. Accounts at other banks are a
 * simulation, and the screen says so at every step: linking one shows what
 * the combined view does, not a real connection.
 */
export function AccountsView(): React.JSX.Element {
  const { t, locale } = usePreferences();
  const toast = useToast();
  const { refresh } = useOverview();
  const [data, setData] = useState<Payload | null>(null);
  const [failed, setFailed] = useState(false);
  const [tick, setTick] = useState(0);
  const [open, setOpen] = useState(false);
  const [bank, setBank] = useState<Bank>("aurora");
  const [kind, setKind] = useState<Kind>("everyday");
  const [nickname, setNickname] = useState("");
  const [included, setIncluded] = useState<"yes" | "no">("yes");
  const [renaming, setRenaming] = useState<Account | null>(null);
  const [error, setError] = useState<MessageKey | null>(null);

  useEffect(() => {
    let cancelled = false;
    api<Payload>("/api/accounts")
      .then((payload) => {
        if (cancelled) return;
        setData(payload);
        setFailed(false);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [tick]);

  // The balance and estimates elsewhere in the app change with what is linked.
  const reload = useCallback(() => {
    setTick((value) => value + 1);
    refresh();
  }, [refresh]);
  const money = (cents: number): string => formatMoney(cents, locale);

  async function send(payload: Record<string, unknown>, message: MessageKey): Promise<boolean> {
    setError(null);
    try {
      await api("/api/accounts", { method: "POST", json: payload });
    } catch (failure) {
      const reason = failure instanceof ApiError ? failure.code : "";
      if (reason === "too_many") setError("accounts.tooMany");
      else toast.fail();
      return false;
    }
    toast.notify(message);
    reload();
    return true;
  }

  function close(): void {
    setOpen(false);
    setRenaming(null);
    setNickname("");
    setBank("aurora");
    setKind("everyday");
    setIncluded("yes");
    setError(null);
  }

  const total = (data?.accounts ?? [])
    .filter((account) => account.included)
    .reduce((sum, account) => sum + account.balanceCents, 0);
  const defaultName = `${t(`accounts.bank.${bank}`)} · ${t(`accounts.kind.${kind}`)}`;

  return (
    <div className="flex flex-col gap-5 px-4 py-4">
      <div>
        <h1 className="text-xl font-semibold">{t("accounts.title")}</h1>
        <p className="mt-1 text-sm text-muted">{t("accounts.intro")}</p>
      </div>
      <p className="rounded-2xl border border-warning bg-warning-soft px-4 py-3 text-sm">
        {t("accounts.simulation")}
      </p>
      {failed ? (
        <div
          role="alert"
          className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-warning bg-warning-soft px-4 py-3 text-sm"
        >
          <span>{t("admin.loadFailed")}</span>
          <button type="button" className="font-semibold underline" onClick={reload}>
            {t("admin.retry")}
          </button>
        </div>
      ) : null}

      {data ? (
        <>
          <section className="rounded-2xl bg-brand p-5 text-on-brand">
            <p className="text-sm opacity-80">{t("accounts.total")}</p>
            <p className="mt-1 text-3xl font-semibold tabular-nums">{money(total)}</p>
            <p className="mt-1 text-xs opacity-80">
              {t("accounts.total.note", {
                count: data.accounts.filter((account) => account.included).length,
              })}
            </p>
          </section>

          <ul className="grid gap-3 md:grid-cols-2">
            {data.accounts.map((account) => (
              <li
                key={account.id}
                className="flex flex-col gap-2 rounded-2xl border border-border bg-surface p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="truncate text-base font-semibold">
                      {account.simulated ? account.nickname : t("accounts.main")}
                    </h2>
                    <p className="text-xs text-muted">
                      {account.simulated && account.bank
                        ? `${t(`accounts.bank.${account.bank}`)} · ${t(`accounts.kind.${account.kind}` as MessageKey)}`
                        : t("accounts.main.note")}
                    </p>
                  </div>
                  {account.simulated ? (
                    <span className="shrink-0 rounded-full bg-warning-soft px-2.5 py-1 text-xs font-semibold text-warning">
                      {t("accounts.simulated")}
                    </span>
                  ) : null}
                </div>
                <p className="text-2xl font-semibold tabular-nums">{money(account.balanceCents)}</p>
                {account.simulated ? (
                  <>
                    <label className="flex items-center justify-between gap-3 text-sm">
                      <span>{t("accounts.include")}</span>
                      <input
                        type="checkbox"
                        role="switch"
                        checked={account.included}
                        onChange={(event) =>
                          void send(
                            { action: "update", id: account.id, included: event.target.checked },
                            "toast.updated",
                          )
                        }
                        className="size-5 accent-[var(--accent)]"
                      />
                    </label>
                    <div className="flex gap-4 text-sm font-semibold">
                      <button
                        type="button"
                        className="text-accent"
                        onClick={() => {
                          setNickname(account.nickname ?? "");
                          setRenaming(account);
                        }}
                      >
                        {t("common.edit")}
                      </button>
                      <button
                        type="button"
                        className="text-muted"
                        onClick={() =>
                          void send({ action: "unlink", id: account.id }, "toast.movedToBin")
                        }
                      >
                        {t("common.moveToBin")}
                      </button>
                    </div>
                  </>
                ) : null}
              </li>
            ))}
          </ul>

          <button
            type="button"
            onClick={() => setOpen(true)}
            className="self-start rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-on-primary"
          >
            {t("accounts.link")}
          </button>
          <p className="text-xs text-muted">{t("accounts.note")}</p>
        </>
      ) : failed ? null : (
        <p className="py-10 text-center text-sm text-muted" role="status">
          …
        </p>
      )}

      <Wizard
        open={open}
        title={t("accounts.link")}
        finishLabel={t("accounts.link.confirm")}
        error={error ? t(error) : null}
        onClose={close}
        onFinish={async () => {
          const done = await send(
            {
              action: "link",
              bank,
              kind,
              nickname: nickname.trim() || defaultName,
              included: included === "yes",
            },
            "toast.saved",
          );
          if (done) close();
          return done;
        }}
        steps={[
          {
            title: t("accounts.step.bank"),
            hint: t("accounts.step.bankHint"),
            valid: true,
            content: (
              <WizardChoices
                name="account-bank"
                value={bank}
                onChange={setBank}
                options={(data?.banks ?? []).map((value) => ({
                  value,
                  label: t(`accounts.bank.${value}`),
                  note: t("accounts.bank.note"),
                }))}
              />
            ),
          },
          {
            title: t("accounts.step.kind"),
            hint: t("accounts.step.kindHint"),
            valid: true,
            content: (
              <WizardChoices
                name="account-kind"
                value={kind}
                onChange={(value) => {
                  setKind(value);
                  // Savings are usually not for spending, so they start outside the calculations.
                  setIncluded(value === "savings" ? "no" : "yes");
                }}
                options={(data?.kinds ?? []).map((value) => ({
                  value,
                  label: t(`accounts.kind.${value}`),
                  note: t(`accounts.kind.${value}.note`),
                }))}
              />
            ),
          },
          {
            title: t("accounts.step.consent"),
            hint: t("accounts.step.consentHint"),
            valid: true,
            content: (
              <div className="flex flex-col gap-3 text-sm">
                <p className="rounded-xl border border-warning bg-warning-soft px-3 py-2">
                  {t("accounts.consent.simulated")}
                </p>
                <p className="text-muted">{t("accounts.consent.real")}</p>
              </div>
            ),
          },
          {
            title: t("accounts.step.name"),
            hint: t("accounts.step.nameHint"),
            valid: true,
            content: (
              <>
                <WizardField
                  label={t("accounts.step.name")}
                  value={nickname}
                  onChange={(event) => setNickname(event.target.value)}
                  placeholder={defaultName}
                  maxLength={40}
                  autoFocus
                />
                <Suggestions
                  label={t("wizard.suggestions")}
                  options={[
                    defaultName,
                    t("accounts.name.suggest.1"),
                    t("accounts.name.suggest.2"),
                  ].map((value) => ({ label: value, value }))}
                  onPick={setNickname}
                />
                <WizardChoices
                  name="account-included"
                  value={included}
                  onChange={setIncluded}
                  options={[
                    {
                      value: "yes",
                      label: t("accounts.include.yes"),
                      note: t("accounts.include.yes.note"),
                    },
                    {
                      value: "no",
                      label: t("accounts.include.no"),
                      note: t("accounts.include.no.note"),
                    },
                  ]}
                />
              </>
            ),
          },
          {
            title: t("wizard.review"),
            hint: t("wizard.reviewHint"),
            valid: true,
            content: (
              <WizardReview
                rows={[
                  {
                    label: t("accounts.step.bank"),
                    value: `${t(`accounts.bank.${bank}`)} (${t("accounts.simulated")})`,
                  },
                  { label: t("accounts.step.kind"), value: t(`accounts.kind.${kind}`) },
                  { label: t("accounts.step.name"), value: nickname.trim() || defaultName },
                  {
                    label: t("accounts.include"),
                    value: t(included === "yes" ? "accounts.include.yes" : "accounts.include.no"),
                  },
                ]}
              />
            ),
          },
        ]}
      />

      <Wizard
        open={renaming !== null}
        title={t("accounts.rename")}
        finishLabel={t("common.save")}
        onClose={close}
        onFinish={async () => {
          if (!renaming) return false;
          const done = await send(
            { action: "update", id: renaming.id, nickname: nickname.trim() },
            "toast.updated",
          );
          if (done) close();
          return done;
        }}
        steps={[
          {
            title: t("accounts.step.name"),
            hint: t("accounts.step.nameHint"),
            valid: nickname.trim().length > 0,
            content: (
              <WizardField
                label={t("accounts.step.name")}
                value={nickname}
                onChange={(event) => setNickname(event.target.value)}
                maxLength={40}
                autoFocus
              />
            ),
          },
        ]}
      />
    </div>
  );
}
