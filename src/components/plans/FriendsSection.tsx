"use client";

import { useCallback, useEffect, useState } from "react";

import { usePreferences } from "@/components/providers/PreferencesProvider";
import { useToast } from "@/components/providers/ToastProvider";
import { Suggestions, Wizard, WizardField, WizardReview } from "@/components/ui/Wizard";
import { api, ApiError } from "@/lib/api-client";
import type { MessageKey } from "@/lib/i18n/translate";

const SLICES = ["bills", "essentials", "everyday", "saving", "investing"] as const;

interface SharedPlan {
  code: string;
  name: string;
  split: Record<(typeof SLICES)[number], number>;
}

interface Payload {
  sharing: boolean;
  code: string | null;
  friends: { id: string; nickname: string; plans: SharedPlan[] }[];
}

/**
 * Friends: add someone by the code they gave you and see the plans they have
 * chosen to share, as percentages. Nothing else about them is visible, and
 * they are not told that you added them.
 */
export function FriendsSection({
  onTry,
  onReport,
}: {
  /** Opens a shared plan worked out on the customer's own income. */
  onTry: (code: string) => void;
  onReport: (code: string) => void;
}): React.JSX.Element | null {
  const { t } = usePreferences();
  const toast = useToast();
  const [data, setData] = useState<Payload | null>(null);
  const [tick, setTick] = useState(0);
  const [open, setOpen] = useState(false);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [nickname, setNickname] = useState("");
  const [error, setError] = useState<MessageKey | null>(null);

  useEffect(() => {
    let cancelled = false;
    api<Payload>("/api/friends")
      .then((payload) => {
        if (!cancelled) setData(payload);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [tick]);

  const reload = useCallback(() => setTick((value) => value + 1), []);

  function close(): void {
    setOpen(false);
    setRenaming(null);
    setCode("");
    setNickname("");
    setError(null);
  }

  async function save(): Promise<boolean> {
    setError(null);
    try {
      await api("/api/friends", {
        method: "POST",
        json: renaming
          ? { action: "rename", id: renaming, nickname: nickname.trim() }
          : { action: "add", code, nickname: nickname.trim() },
      });
    } catch (failure) {
      const reason = failure instanceof ApiError ? failure.code : "";
      setError(
        reason === "not_found"
          ? "friends.error.notFound"
          : reason === "self"
            ? "friends.error.self"
            : reason === "already"
              ? "friends.error.already"
              : "toast.error",
      );
      return false;
    }
    toast.notify("toast.saved");
    close();
    reload();
    return true;
  }

  async function remove(id: string): Promise<void> {
    try {
      await api("/api/friends", { method: "POST", json: { action: "remove", id } });
      toast.notify("toast.movedToBin");
      reload();
    } catch {
      toast.fail();
    }
  }

  async function copyCode(): Promise<void> {
    if (!data?.code) return;
    try {
      await navigator.clipboard.writeText(data.code);
      toast.notify("toast.linkCopied");
    } catch {
      // The code is on screen to read out or type.
    }
  }

  if (!data?.sharing) return null;
  const cleanCode = code.toUpperCase().replace(/[^A-Z0-9]/g, "");
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-sm font-semibold">{t("friends.title")}</h2>
      <p className="text-xs text-muted">{t("friends.note")}</p>
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-surface px-4 py-3 text-sm">
        <span>
          {t("friends.myCode")}{" "}
          <span className="font-mono font-semibold tracking-widest">{data.code}</span>
        </span>
        <button type="button" className="font-semibold text-accent" onClick={() => void copyCode()}>
          {t("friends.copy")}
        </button>
      </div>
      {data.friends.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border p-5 text-center text-sm text-muted">
          {t("friends.empty")}
        </p>
      ) : null}
      <div className="grid gap-3 md:grid-cols-2">
        {data.friends.map((friend) => (
          <article
            key={friend.id}
            className="flex flex-col gap-2 rounded-2xl border border-border bg-surface p-4"
          >
            <h3 className="text-base font-semibold">{friend.nickname}</h3>
            {friend.plans.length === 0 ? (
              <p className="text-sm text-muted">{t("friends.noPlans")}</p>
            ) : (
              <ul className="flex flex-col divide-y divide-border text-sm">
                {friend.plans.map((plan) => (
                  <li key={plan.code} className="flex flex-col gap-1 py-2">
                    <span className="font-medium">{plan.name}</span>
                    <span className="text-xs text-muted tabular-nums">
                      {SLICES.map((key) => `${t(`plan.slice.${key}`)} ${plan.split[key]} %`).join(
                        " · ",
                      )}
                    </span>
                    <span className="flex gap-4 text-sm font-semibold">
                      <button
                        type="button"
                        className="text-accent"
                        onClick={() => onTry(plan.code)}
                      >
                        {t("plans.tryIt")}
                      </button>
                      <button
                        type="button"
                        className="text-muted"
                        onClick={() => onReport(plan.code)}
                      >
                        {t("plans.report")}
                      </button>
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <div className="flex gap-4 text-sm font-semibold">
              <button
                type="button"
                className="text-accent"
                onClick={() => {
                  setNickname(friend.nickname);
                  setRenaming(friend.id);
                }}
              >
                {t("common.edit")}
              </button>
              <button type="button" className="text-muted" onClick={() => void remove(friend.id)}>
                {t("common.moveToBin")}
              </button>
            </div>
          </article>
        ))}
      </div>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="self-start rounded-full border border-border bg-surface px-5 py-2.5 text-sm font-semibold"
      >
        {t("friends.add")}
      </button>

      <Wizard
        open={open || renaming !== null}
        title={t(renaming ? "friends.rename" : "friends.add")}
        finishLabel={t("common.save")}
        error={error ? t(error) : null}
        onClose={close}
        onFinish={save}
        steps={[
          ...(renaming
            ? []
            : [
                {
                  title: t("friends.step.code"),
                  hint: t("friends.step.codeHint"),
                  valid: cleanCode.length === 8,
                  content: (
                    <WizardField
                      label={t("friends.step.code")}
                      value={code}
                      onChange={(event) => setCode(event.target.value.toUpperCase().slice(0, 9))}
                      placeholder="K7M2QX9P"
                      autoCapitalize="characters"
                      autoComplete="off"
                      maxLength={9}
                      autoFocus
                    />
                  ),
                },
              ]),
          {
            title: t("friends.step.name"),
            hint: t("friends.step.nameHint"),
            valid: nickname.trim().length > 0,
            content: (
              <>
                <WizardField
                  label={t("friends.step.name")}
                  value={nickname}
                  onChange={(event) => setNickname(event.target.value)}
                  maxLength={40}
                  autoFocus
                />
                <Suggestions
                  label={t("wizard.suggestions")}
                  options={(["1", "2", "3"] as const).map((n) => ({
                    label: t(`friends.name.suggest.${n}`),
                    value: t(`friends.name.suggest.${n}`),
                  }))}
                  onPick={setNickname}
                />
              </>
            ),
          },
          ...(renaming
            ? []
            : [
                {
                  title: t("wizard.review"),
                  hint: t("friends.reviewHint"),
                  valid: true,
                  content: (
                    <WizardReview
                      rows={[
                        { label: t("friends.step.code"), value: cleanCode },
                        { label: t("friends.step.name"), value: nickname.trim() },
                      ]}
                    />
                  ),
                },
              ]),
        ]}
      />
    </section>
  );
}
