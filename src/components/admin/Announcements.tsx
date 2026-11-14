"use client";

import { useState } from "react";

import { adminCall, requireResult, unlessSignedOut } from "@/components/admin/admin-api";
import { LoadState } from "@/components/admin/LoadState";
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
import type { MessageKey } from "@/lib/i18n/translate";

type Severity = "info" | "warning" | "good";

interface Announcement {
  id: string;
  title: string;
  body: string;
  severity: Severity;
  deletedAt: string | null;
  views: number;
  publishAt: string | null;
  translations: { fi?: Wording; sv?: Wording };
}

interface Wording {
  title: string;
  body: string;
}

const EMPTY = {
  title: "",
  body: "",
  severity: "info" as Severity,
  when: "now" as "now" | "later",
  /** Local date and time, as a date-time field gives it. */
  publishAt: "",
  fi: { title: "", body: "" },
  sv: { title: "", body: "" },
};

/** What the server expects: a moment in time, and only the languages that were filled in. */
function toPayload(form: typeof EMPTY): Record<string, unknown> {
  const wording = (value: Wording): Wording | undefined =>
    value.title.trim() || value.body.trim()
      ? { title: value.title.trim(), body: value.body.trim() }
      : undefined;
  return {
    title: form.title,
    body: form.body,
    severity: form.severity,
    publishAt:
      form.when === "later" && form.publishAt ? new Date(form.publishAt).toISOString() : null,
    translations: { fi: wording(form.fi), sv: wording(form.sv) },
  };
}
const SEVERITIES: Severity[] = ["info", "warning", "good"];
const EXAMPLES = ["feature", "tip", "break"] as const;

type Result = { announcements: Announcement[] };

/** Notices staff publish to every customer: create, edit, bin, restore and delete for good. */
export function Announcements(): React.JSX.Element {
  const { t } = usePreferences();
  const toast = useToast();
  const { data, failed, reload, setData } = useAdminLoad<Result>("/api/admin/announcements");
  const items = data?.announcements ?? null;
  const [form, setForm] = useState(EMPTY);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  async function submit(): Promise<boolean> {
    const result = editingId
      ? await adminCall<Result>(`/api/admin/announcements/${editingId}`, "PATCH", form)
      : await adminCall<Result>("/api/admin/announcements", "POST", form);
    if (!result) {
      toast.fail("common.saveFailed");
      return false;
    }
    setData(result);
    toast.notify(editingId ? "toast.updated" : "toast.published");
    close();
    return true;
  }

  function close(): void {
    setOpen(false);
    setForm(EMPTY);
    setEditingId(null);
  }

  const live = items?.filter((item) => !item.deletedAt) ?? [];
  const binned = items?.filter((item) => item.deletedAt) ?? [];

  return (
    <div className="flex flex-col gap-4">

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
        onFinish={() => unlessSignedOut(submit)}
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
            title: t("admin.announcements.step.languages"),
            hint: t("admin.announcements.step.languagesHint"),
            valid: true,
            content: (
              <div className="flex flex-col gap-4">
                {(["fi", "sv"] as const).map((language) => (
                  <fieldset key={language} className="flex flex-col gap-2">
                    <legend className="text-sm font-semibold">
                      {t(`admin.announcements.language.${language}` as MessageKey)}
                    </legend>
                    <WizardField
                      label={t("admin.announcements.title")}
                      value={form[language].title}
                      onChange={(event) =>
                        setForm({
                          ...form,
                          [language]: { ...form[language], title: event.target.value },
                        })
                      }
                      maxLength={120}
                    />
                    <label className="flex flex-col gap-1.5 text-sm font-medium">
                      {t("admin.announcements.body")}
                      <textarea
                        value={form[language].body}
                        onChange={(event) =>
                          setForm({
                            ...form,
                            [language]: { ...form[language], body: event.target.value },
                          })
                        }
                        maxLength={600}
                        rows={2}
                        className="rounded-xl border border-border bg-surface px-4 py-3 text-base font-normal outline-none focus-visible:ring-2 focus-visible:ring-accent"
                      />
                    </label>
                  </fieldset>
                ))}
              </div>
            ),
          },
          {
            title: t("admin.announcements.step.when"),
            hint: t("admin.announcements.step.whenHint"),
            valid: form.when === "now" || (form.publishAt !== "" && Date.parse(form.publishAt) > 0),
            content: (
              <>
                <WizardChoices
                  name="announcement-when"
                  value={form.when}
                  onChange={(when) => setForm({ ...form, when })}
                  options={[
                    {
                      value: "now",
                      label: t("admin.announcements.when.now"),
                      note: t("admin.announcements.when.now.note"),
                    },
                    {
                      value: "later",
                      label: t("admin.announcements.when.later"),
                      note: t("admin.announcements.when.later.note"),
                    },
                  ]}
                />
                {form.when === "later" ? (
                  <label className="flex flex-col gap-1.5 text-sm font-medium">
                    {t("admin.announcements.when.at")}
                    <input
                      type="datetime-local"
                      value={form.publishAt}
                      onChange={(event) => setForm({ ...form, publishAt: event.target.value })}
                      className="rounded-xl border border-border bg-surface px-4 py-3 text-base font-normal"
                    />
                  </label>
                ) : null}
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

      <LoadState show={!items} failed={failed} onRetry={reload} />
      {items && live.length === 0 ? (
        <p className="text-sm text-muted">{t("admin.announcements.empty")}</p>
      ) : null}
      <ul className="flex flex-col gap-2">
        {live.map((item) => (
          <AnnouncementRow
            key={item.id}
            item={item}
            onChange={setData}
            onEdit={() => {
              setEditingId(item.id);
              setForm({ ...EMPTY, title: item.title, body: item.body, severity: item.severity });
              setOpen(true);
            }}
          />
        ))}
      </ul>

      {binned.length > 0 ? (
        <div className="flex flex-col gap-2">
          <h3 className="text-sm font-semibold">{t("admin.bin")}</h3>
          <ul className="flex flex-col gap-2">
            {binned.map((item) => (
              <AnnouncementRow key={item.id} item={item} onChange={setData} />
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

type Action = "trash" | "restore" | "purge";

function AnnouncementRow({
  item,
  onEdit,
  onChange,
}: {
  item: Announcement;
  /** Only live announcements can be edited. */
  onEdit?: () => void;
  onChange: (result: Result) => void;
}): React.JSX.Element {
  const { t } = usePreferences();
  const toast = useToast();
  const [which, setWhich] = useState<Action>("trash");
  const { run, pending } = useAsyncAction(async (action: Action): Promise<void> => {
    const result = requireResult(
      await adminCall<Result>(`/api/admin/announcements/${item.id}`, "POST", { action }),
    );
    onChange(result);
    toast.notify(
      action === "trash"
        ? "toast.movedToBin"
        : action === "restore"
          ? "toast.restored"
          : "toast.deleted",
    );
  });
  const start = (action: Action): void => {
    setWhich(action);
    void run(action);
  };

  if (item.deletedAt) {
    return (
      <li className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-dashed border-border px-4 py-3 text-sm">
        <span className="text-muted">{item.title}</span>
        <span className="flex gap-4 font-semibold">
          <RowButton
            pending={pending}
            active={which === "restore"}
            pendingLabel={t("common.restoring")}
            className="min-h-11 text-accent"
            onClick={() => start("restore")}
          >
            {t("common.restore")}
          </RowButton>
          <RowButton
            pending={pending}
            active={which === "purge"}
            pendingLabel={t("common.deleting")}
            className="min-h-11 text-warning"
            onClick={() => start("purge")}
          >
            {t("common.deleteForever")}
          </RowButton>
        </span>
      </li>
    );
  }
  return (
    <li className="rounded-xl border border-border px-4 py-3 text-sm">
      <p className="font-semibold">
        {item.title}{" "}
        <span className="font-normal text-muted">
          · {t(`admin.announcements.severity.${item.severity}` as MessageKey)}
        </span>
      </p>
      <p className="mt-0.5 text-muted">{item.body}</p>
      <p className="mt-1 text-xs text-muted">{t("admin.reach", { count: item.views })}</p>
      <div className="mt-2 flex gap-4 font-semibold">
        <button type="button" onClick={onEdit} className="min-h-11 text-accent">
          {t("common.edit")}
        </button>
        <RowButton
          pending={pending}
          pendingLabel={t("common.deleting")}
          className="min-h-11 text-muted"
          onClick={() => start("trash")}
        >
          {t("common.moveToBin")}
        </RowButton>
      </div>
    </li>
  );
}
