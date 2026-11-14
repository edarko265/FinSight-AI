"use client";

import { useState } from "react";

import { adminCall, requireResult, unlessSignedOut } from "@/components/admin/admin-api";
import { LoadState } from "@/components/admin/LoadState";
import { Panel } from "@/components/admin/parts";
import { RowButton } from "@/components/admin/RowButton";
import { useAdminLoad } from "@/components/admin/use-admin-load";
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
import { hasMessage, type MessageKey } from "@/lib/i18n/translate";

interface TaughtAnswer {
  id: string;
  theme: string;
  keywords: string[];
  answers: { en: string; fi: string; sv: string };
  uses: number;
  deletedAt: string | null;
}

const THEMES = [
  "loans",
  "investing",
  "insurance",
  "cards",
  "taxes",
  "pension",
  "benefits",
  "account",
  "budgeting",
  "other",
] as const;
type Theme = (typeof THEMES)[number];
const LANGUAGES = ["en", "fi", "sv"] as const;

const EMPTY = { theme: "loans" as Theme, keywords: "", en: "", fi: "", sv: "" };
type Result = { answers: TaughtAnswer[] };

/**
 * Teaching the coach. Lists the kinds of question it had no answer for, lets
 * staff write the answer it should have given, and shows how often each
 * taught answer has since been used.
 */
export function Training({
  gaps,
}: {
  gaps: { topic: string; count: number }[];
}): React.JSX.Element {
  const { t } = usePreferences();
  const toast = useToast();
  const { data, failed, reload, setData } = useAdminLoad<Result>("/api/admin/training");
  const items = data?.answers ?? null;
  const [form, setForm] = useState(EMPTY);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  const theme = (name: string): string =>
    hasMessage(`admin.theme.${name}`) ? t(`admin.theme.${name}` as MessageKey) : name;
  const live = items?.filter((item) => !item.deletedAt) ?? [];
  const covered = new Set(
    live.filter((item) => item.keywords.length === 0).map((item) => item.theme),
  );
  const keywords = form.keywords
    .split(",")
    .map((word) => word.trim())
    .filter((word) => word.length >= 2);

  function close(): void {
    setOpen(false);
    setForm(EMPTY);
    setEditingId(null);
  }

  function teach(name: string): void {
    setForm({
      ...EMPTY,
      theme: (THEMES as readonly string[]).includes(name) ? (name as Theme) : "other",
    });
    setEditingId(null);
    setOpen(true);
  }

  async function submit(): Promise<boolean> {
    const payload = {
      theme: form.theme,
      keywords,
      answers: { en: form.en.trim(), fi: form.fi.trim(), sv: form.sv.trim() },
    };
    const result = editingId
      ? await adminCall<Result>(`/api/admin/training/${editingId}`, "PATCH", payload)
      : await adminCall<Result>("/api/admin/training", "POST", payload);
    if (!result) {
      toast.fail("common.saveFailed");
      return false;
    }
    setData(result);
    toast.notify(editingId ? "toast.updated" : "toast.saved");
    close();
    return true;
  }

  const answerStep = (language: (typeof LANGUAGES)[number], required: boolean) => ({
    title: t(`admin.training.answer.${language}` as MessageKey),
    hint: t(required ? "admin.training.answer.hint" : "admin.training.answer.optional"),
    valid: !required || Boolean(form.en.trim() || form.fi.trim() || form.sv.trim()),
    content: (
      <>
        <label className="flex flex-col gap-1.5 text-sm font-medium">
          {t(`admin.training.answer.${language}` as MessageKey)}
          <textarea
            value={form[language]}
            onChange={(event) => setForm({ ...form, [language]: event.target.value })}
            placeholder={t(`admin.training.example.${form.theme}` as MessageKey)}
            maxLength={1200}
            rows={6}
            autoFocus
            className="rounded-xl border border-border bg-surface px-4 py-3 text-base font-normal outline-none focus-visible:ring-2 focus-visible:ring-accent"
          />
        </label>
        {language === "en" ? (
          <Suggestions
            label={t("wizard.suggestions")}
            options={[{ label: t("admin.training.useExample"), value: "example" }]}
            onPick={() =>
              setForm({ ...form, en: t(`admin.training.example.${form.theme}` as MessageKey) })
            }
          />
        ) : null}
      </>
    ),
  });

  return (
    <>
      <Panel title={t("admin.training.gaps")}>
        <p className="text-sm text-muted">{t("admin.training.gaps.note")}</p>
        {gaps.length === 0 ? (
          <p className="text-sm text-muted">{t("admin.themes.empty")}</p>
        ) : (
          <ul className="flex flex-col divide-y divide-border text-sm">
            {gaps.map((gap) => (
              <li
                key={gap.topic}
                className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 py-2.5"
              >
                <span>
                  <span className="font-medium">{theme(gap.topic)}</span>{" "}
                  <span className="text-muted tabular-nums">
                    · {t("admin.training.asked", { count: gap.count })}
                  </span>
                </span>
                {covered.has(gap.topic) ? (
                  <span className="rounded-full bg-accent-soft px-3 py-1 text-xs font-semibold text-accent">
                    {t("admin.training.covered")}
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => teach(gap.topic)}
                    className="rounded-full bg-primary px-4 py-1.5 text-sm font-semibold text-on-primary"
                  >
                    {t("admin.training.teach")}
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Panel title={t("admin.training.taught")}>
        <button
          type="button"
          onClick={() => teach("loans")}
          className="self-start rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-on-primary"
        >
          {t("admin.training.new")}
        </button>
        <LoadState show={!items} failed={failed} onRetry={reload} />
        {items && live.length === 0 ? (
          <p className="text-sm text-muted">{t("admin.training.empty")}</p>
        ) : null}
        <ul className="flex flex-col gap-2">
          {live.map((item) => (
            <TrainingRow
              key={item.id}
              item={item}
              themeLabel={theme(item.theme)}
              onEdit={() => {
                setEditingId(item.id);
                setForm({
                  theme: (THEMES as readonly string[]).includes(item.theme)
                    ? (item.theme as Theme)
                    : "other",
                  keywords: item.keywords.join(", "),
                  ...item.answers,
                });
                setOpen(true);
              }}
              onChange={setData}
            />
          ))}
        </ul>
        <p className="text-sm text-muted">{t("admin.training.note")}</p>
      </Panel>

      <Wizard
        open={open}
        title={t(editingId ? "admin.training.edit" : "admin.training.new")}
        finishLabel={t("common.save")}
        onClose={close}
        onFinish={() => unlessSignedOut(submit)}
        steps={[
          {
            title: t("admin.training.step.theme"),
            hint: t("admin.training.step.themeHint"),
            valid: true,
            content: (
              <WizardChoices
                name="training-theme"
                value={form.theme}
                onChange={(value) => setForm({ ...form, theme: value })}
                options={THEMES.map((name) => ({ value: name, label: theme(name) }))}
              />
            ),
          },
          {
            title: t("admin.training.step.keywords"),
            hint: t("admin.training.step.keywordsHint"),
            valid: true,
            content: (
              <>
                <WizardField
                  label={t("admin.training.keywords")}
                  value={form.keywords}
                  onChange={(event) => setForm({ ...form, keywords: event.target.value })}
                  placeholder={t(`admin.training.words.${form.theme}` as MessageKey)}
                  maxLength={300}
                  autoFocus
                />
                <Suggestions
                  label={t("wizard.suggestions")}
                  options={t(`admin.training.words.${form.theme}` as MessageKey)
                    .split(",")
                    .map((word) => word.trim())
                    .filter(Boolean)
                    .map((word) => ({ label: word, value: word }))}
                  onPick={(word) =>
                    setForm({
                      ...form,
                      keywords: keywords.includes(word)
                        ? form.keywords
                        : [...keywords, word].join(", "),
                    })
                  }
                />
              </>
            ),
          },
          answerStep("en", true),
          answerStep("fi", false),
          answerStep("sv", false),
          {
            title: t("wizard.review"),
            hint: t("wizard.reviewHint"),
            valid: Boolean(form.en.trim() || form.fi.trim() || form.sv.trim()),
            content: (
              <WizardReview
                rows={[
                  { label: t("admin.training.step.theme"), value: theme(form.theme) },
                  {
                    label: t("admin.training.keywords"),
                    value: keywords.join(", ") || t("admin.training.wholeTheme"),
                  },
                  ...LANGUAGES.filter((language) => form[language].trim()).map((language) => ({
                    label: t(`admin.training.answer.${language}` as MessageKey),
                    value: form[language].trim(),
                  })),
                ]}
              />
            ),
          },
        ]}
      />
    </>
  );
}

function TrainingRow({
  item,
  themeLabel,
  onEdit,
  onChange,
}: {
  item: TaughtAnswer;
  themeLabel: string;
  onEdit: () => void;
  onChange: (result: Result) => void;
}): React.JSX.Element {
  const { t } = usePreferences();
  const toast = useToast();
  const { run, pending } = useAsyncAction(async (): Promise<void> => {
    const result = requireResult(
      await adminCall<Result>(`/api/admin/training/${item.id}`, "POST", { action: "trash" }),
    );
    onChange(result);
    toast.notify("toast.movedToBin");
  });
  return (
    <li className="rounded-xl border border-border px-4 py-3 text-sm">
      <p className="font-semibold">
        {themeLabel}
        <span className="font-normal text-muted">
          {" · "}
          {item.keywords.length > 0 ? item.keywords.join(", ") : t("admin.training.wholeTheme")}
        </span>
      </p>
      <p className="mt-1 line-clamp-3 whitespace-pre-line text-muted">
        {item.answers.en || item.answers.fi || item.answers.sv}
      </p>
      <p className="mt-1 text-sm text-muted">
        {t("admin.training.uses", { count: item.uses })}
        {" · "}
        {LANGUAGES.filter((language) => item.answers[language])
          .map((language) => language.toUpperCase())
          .join(" ")}
      </p>
      <div className="mt-2 flex gap-4 font-semibold">
        <button type="button" className="min-h-11 text-accent" onClick={onEdit}>
          {t("common.edit")}
        </button>
        <RowButton
          pending={pending}
          pendingLabel={t("common.deleting")}
          className="min-h-11 text-muted"
          onClick={() => void run()}
        >
          {t("common.moveToBin")}
        </RowButton>
      </div>
    </li>
  );
}
