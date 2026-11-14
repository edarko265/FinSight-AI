"use client";

import { useEffect, useState } from "react";

import { usePreferences } from "@/components/providers/PreferencesProvider";
import {
  Suggestions,
  Wizard,
  WizardChoices,
  WizardField,
  WizardReview,
} from "@/components/ui/Wizard";
import type { MessageKey } from "@/lib/i18n/translate";

type Severity = "info" | "warning" | "good";

interface Announcement {
  id: string;
  title: string;
  body: string;
  severity: Severity;
  deletedAt: string | null;
}

const EMPTY = { title: "", body: "", severity: "info" as Severity };
const SEVERITIES: Severity[] = ["info", "warning", "good"];
const EXAMPLES = ["feature", "tip", "break"] as const;

async function call(
  path: string,
  method: string,
  payload?: unknown,
): Promise<Announcement[] | null> {
  const response = await fetch(path, {
    method,
    credentials: "same-origin",
    headers: payload ? { "Content-Type": "application/json" } : undefined,
    body: payload ? JSON.stringify(payload) : undefined,
  });
  if (!response.ok) return null;
  return ((await response.json()) as { announcements: Announcement[] }).announcements;
}

/** Notices staff publish to every customer: create, edit, bin, restore and delete for good. */
export function Announcements(): React.JSX.Element {
  const { t } = usePreferences();
  const [items, setItems] = useState<Announcement[] | null>(null);
  const [form, setForm] = useState(EMPTY);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void call("/api/admin/announcements", "GET").then((list) => {
      if (!cancelled && list) setItems(list);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const apply = (list: Announcement[] | null): void => {
    if (list) setItems(list);
  };

  async function submit(): Promise<void> {
    apply(
      editingId
        ? await call(`/api/admin/announcements/${editingId}`, "PATCH", form)
        : await call("/api/admin/announcements", "POST", form),
    );
    close();
  }

  function close(): void {
    setOpen(false);
    setForm(EMPTY);
    setEditingId(null);
  }

  const act = async (id: string, action: "trash" | "restore" | "purge"): Promise<void> =>
    apply(await call(`/api/admin/announcements/${id}`, "POST", { action }));

  const live = items?.filter((item) => !item.deletedAt) ?? [];
  const binned = items?.filter((item) => item.deletedAt) ?? [];

  return (
    <div className="flex flex-col gap-4">
      <p className="text-xs text-muted">{t("admin.announcements.note")}</p>

      <button
        type="button"
        onClick={() => setOpen(true)}
        className="self-start rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-on-primary"
      >
        {t("admin.announcements.new")}
      </button>

      <Wizard
        open={open}
        title={t(editingId ? "admin.announcements.editTitle" : "admin.announcements.new")}
        finishLabel={t(editingId ? "common.save" : "admin.announcements.publish")}
        onClose={close}
        onFinish={submit}
        steps={[
          {
            title: t("admin.announcements.step.type"),
            hint: t("admin.announcements.step.typeHint"),
            valid: true,
            content: (
              <WizardChoices
                name="announcement-severity"
                value={form.severity}
                onChange={(severity) => setForm({ ...form, severity })}
                options={SEVERITIES.map((severity) => ({
                  value: severity,
                  label: t(`admin.announcements.severity.${severity}` as MessageKey),
                }))}
              />
            ),
          },
          {
            title: t("admin.announcements.title"),
            hint: t("admin.announcements.step.titleHint"),
            valid: form.title.trim().length > 0,
            content: (
              <>
                <WizardField
                  label={t("admin.announcements.title")}
                  value={form.title}
                  onChange={(event) => setForm({ ...form, title: event.target.value })}
                  placeholder={t("admin.announcements.suggest.feature")}
                  maxLength={120}
                  autoFocus
                />
                <Suggestions
                  label={t("wizard.suggestions")}
                  options={EXAMPLES.map((example) => ({
                    label: t(`admin.announcements.suggest.${example}` as MessageKey),
                    value: example,
                  }))}
                  onPick={(example) =>
                    setForm({
                      ...form,
                      title: t(`admin.announcements.suggest.${example}` as MessageKey),
                      body:
                        form.body || t(`admin.announcements.suggestBody.${example}` as MessageKey),
                    })
                  }
                />
              </>
            ),
          },
          {
            title: t("admin.announcements.body"),
            hint: t("admin.announcements.step.bodyHint"),
            valid: form.body.trim().length > 0,
            content: (
              <label className="flex flex-col gap-1.5 text-sm font-medium">
                {t("admin.announcements.body")}
                <textarea
                  value={form.body}
                  onChange={(event) => setForm({ ...form, body: event.target.value })}
                  placeholder={t("admin.announcements.suggestBody.feature")}
                  maxLength={600}
                  rows={4}
                  autoFocus
                  className="rounded-xl border border-border bg-surface px-4 py-3 text-base font-normal outline-none focus-visible:ring-2 focus-visible:ring-accent"
                />
              </label>
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
                    label: t("admin.announcements.severity"),
                    value: t(`admin.announcements.severity.${form.severity}` as MessageKey),
                  },
                  { label: t("admin.announcements.title"), value: form.title },
                  { label: t("admin.announcements.body"), value: form.body },
                ]}
              />
            ),
          },
        ]}
      />

      {items && live.length === 0 ? (
        <p className="text-sm text-muted">{t("admin.announcements.empty")}</p>
      ) : null}
      <ul className="flex flex-col gap-2">
        {live.map((item) => (
          <li key={item.id} className="rounded-xl border border-border px-4 py-3 text-sm">
            <p className="font-semibold">
              {item.title}{" "}
              <span className="font-normal text-muted">
                · {t(`admin.announcements.severity.${item.severity}` as MessageKey)}
              </span>
            </p>
            <p className="mt-0.5 text-muted">{item.body}</p>
            <div className="mt-2 flex gap-4 font-semibold">
              <button
                type="button"
                onClick={() => {
                  setEditingId(item.id);
                  setForm({ title: item.title, body: item.body, severity: item.severity });
                  setOpen(true);
                }}
                className="text-accent"
              >
                {t("common.edit")}
              </button>
              <button
                type="button"
                onClick={() => void act(item.id, "trash")}
                className="text-muted"
              >
                {t("common.moveToBin")}
              </button>
            </div>
          </li>
        ))}
      </ul>

      {binned.length > 0 ? (
        <div className="flex flex-col gap-2">
          <h3 className="text-sm font-semibold">{t("admin.bin")}</h3>
          <ul className="flex flex-col gap-2">
            {binned.map((item) => (
              <li
                key={item.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-dashed border-border px-4 py-3 text-sm"
              >
                <span className="text-muted">{item.title}</span>
                <span className="flex gap-4 font-semibold">
                  <button
                    type="button"
                    onClick={() => void act(item.id, "restore")}
                    className="text-accent"
                  >
                    {t("common.restore")}
                  </button>
                  <button
                    type="button"
                    onClick={() => void act(item.id, "purge")}
                    className="text-warning"
                  >
                    {t("common.deleteForever")}
                  </button>
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
