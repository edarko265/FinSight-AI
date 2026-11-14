"use client";

import { useState } from "react";

import { adminCall, adminSubmit, requireResult } from "@/components/admin/admin-api";
import { LoadState } from "@/components/admin/LoadState";
import { Panel, Stat } from "@/components/admin/parts";
import { RowButton } from "@/components/admin/RowButton";
import { useAdminLoad } from "@/components/admin/use-admin-load";
import { usePreferences } from "@/components/providers/PreferencesProvider";
import { useToast } from "@/components/providers/ToastProvider";
import { PasswordField } from "@/components/ui/PasswordField";
import { useAsyncAction } from "@/components/ui/useAsyncAction";
import {
  Suggestions,
  Wizard,
  WizardChoices,
  WizardField,
  WizardReview,
} from "@/components/ui/Wizard";
import type { MessageKey } from "@/lib/i18n/translate";

type Role = "admin" | "adviser" | "banker";
const ROLES: Role[] = ["adviser", "banker", "admin"];

interface Member {
  id: string;
  name: string;
  username: string;
  role: Role;
  deletedAt: string | null;
}

type Result = { staff: Member[] };
const EMPTY = { name: "", username: "", role: "adviser" as Role, password: "" };
const USERNAME = /^[a-z0-9][a-z0-9._-]{2,39}$/;

/** A password nobody has to think up: four groups of letters and digits, easy to read out. */
function strongPassword(): string {
  const alphabet = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const picks = crypto.getRandomValues(new Uint32Array(16));
  const letters = Array.from(picks, (pick) => alphabet[pick % alphabet.length]);
  return [0, 4, 8, 12].map((start) => letters.slice(start, start + 4).join("")).join("-");
}

/** Usernames built from the name, for the suggestions under the field. */
function usernamesFor(name: string): string[] {
  const parts = name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[^a-z0-9 ]/g, "")
    .split(" ")
    .filter(Boolean);
  const first = parts[0];
  const last = parts.at(-1);
  if (!first) return [];
  if (!last || parts.length === 1) return [first].filter((value) => value.length >= 3);
  return [...new Set([`${first}.${last}`, `${first[0]}${last}`, `${first}${last[0]}`])].filter(
    (value) => value.length >= 3,
  );
}

/** People who can sign in to the admin area: add, edit, bin, restore, delete for good. */
export function Team({ myId }: { myId: string }): React.JSX.Element {
  const { t } = usePreferences();
  const toast = useToast();
  const { data, failed, reload, setData } = useAdminLoad<Result>("/api/admin/staff");
  const items = data?.staff ?? null;
  const [form, setForm] = useState(EMPTY);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<MessageKey | null>(null);

  const live = items?.filter((item) => !item.deletedAt) ?? [];
  const binned = items?.filter((item) => item.deletedAt) ?? [];
  const role = (value: Role): string => t(`admin.role.${value}` as MessageKey);

  function close(): void {
    setOpen(false);
    setForm(EMPTY);
    setEditingId(null);
    setError(null);
  }

  async function submit(): Promise<boolean> {
    setError(null);
    const result = editingId
      ? await adminSubmit<Result>(`/api/admin/staff/${editingId}`, "PATCH", {
          name: form.name.trim(),
          role: form.role,
          password: form.password || undefined,
        })
      : await adminSubmit<Result>("/api/admin/staff", "POST", {
          ...form,
          name: form.name.trim(),
          username: form.username.trim().toLowerCase(),
        });
    if (!result.ok) {
      setError(result.error === "username_taken" ? "admin.team.taken" : "toast.error");
      return false;
    }
    setData(result.data);
    toast.notify(editingId ? "toast.updated" : "toast.saved");
    close();
    return true;
  }

  const passwordValid = editingId
    ? form.password.length === 0 || form.password.length >= 10
    : form.password.length >= 10;

  return (
    <>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label={t("admin.team.count")} value={String(live.length)} />
        {ROLES.map((value) => (
          <Stat
            key={value}
            label={role(value)}
            value={String(live.filter((member) => member.role === value).length)}
          />
        ))}
      </div>
      <Panel title={t("admin.team.members")}>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="self-start rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-on-primary"
        >
          {t("admin.team.add")}
        </button>
        <LoadState show={!items} failed={failed} onRetry={reload} />
        {items && live.length === 0 ? (
          <p className="text-sm text-muted">{t("admin.team.empty")}</p>
        ) : null}
        <ul className="flex flex-col gap-2">
          {live.map((member) => (
            <MemberRow
              key={member.id}
              member={member}
              mine={member.id === myId}
              roleLabel={role(member.role)}
              onEdit={() => {
                setEditingId(member.id);
                setForm({
                  name: member.name,
                  username: member.username,
                  role: member.role,
                  password: "",
                });
                setOpen(true);
              }}
              onChange={setData}
            />
          ))}
        </ul>
        {binned.length > 0 ? (
          <div className="flex flex-col gap-2">
            <h3 className="text-sm font-semibold">{t("admin.bin")}</h3>
            <ul className="flex flex-col gap-2">
              {binned.map((member) => (
                <MemberRow
                  key={member.id}
                  member={member}
                  mine={false}
                  roleLabel={role(member.role)}
                  onChange={setData}
                />
              ))}
            </ul>
          </div>
        ) : null}
        <p className="text-xs text-muted">{t("admin.team.note")}</p>
      </Panel>
      <Panel title={t("admin.team.roles")}>
        <dl className="grid gap-x-4 gap-y-2 text-sm sm:grid-cols-[auto_1fr]">
          <dt className="font-semibold">{t("admin.role.owner")}</dt>
          <dd className="text-muted">{t("admin.role.owner.note")}</dd>
          {(["admin", "adviser", "banker"] as const).map((value) => (
            <div key={value} className="contents">
              <dt className="font-semibold">{role(value)}</dt>
              <dd className="text-muted">{t(`admin.role.${value}.note` as MessageKey)}</dd>
            </div>
          ))}
        </dl>
      </Panel>

      <Wizard
        open={open}
        title={t(editingId ? "admin.team.edit" : "admin.team.add")}
        finishLabel={t("common.save")}
        error={error ? t(error) : null}
        onClose={close}
        onFinish={submit}
        steps={[
          {
            title: t("admin.team.name"),
            hint: t("admin.team.nameHint"),
            valid: form.name.trim().length > 0,
            content: (
              <WizardField
                label={t("admin.team.name")}
                value={form.name}
                onChange={(event) => setForm({ ...form, name: event.target.value })}
                placeholder="Aino Virtanen"
                maxLength={80}
                autoComplete="off"
                autoFocus
              />
            ),
          },
          ...(editingId
            ? []
            : [
                {
                  title: t("admin.login.username"),
                  hint: t("admin.team.usernameHint"),
                  valid: USERNAME.test(form.username.trim().toLowerCase()),
                  content: (
                    <>
                      <WizardField
                        label={t("admin.login.username")}
                        value={form.username}
                        onChange={(event) => setForm({ ...form, username: event.target.value })}
                        placeholder={usernamesFor(form.name)[0] ?? "aino.virtanen"}
                        maxLength={40}
                        autoCapitalize="none"
                        autoComplete="off"
                        autoFocus
                      />
                      <Suggestions
                        label={t("wizard.suggestions")}
                        options={usernamesFor(form.name).map((value) => ({ label: value, value }))}
                        onPick={(value) => setForm({ ...form, username: value })}
                      />
                    </>
                  ),
                },
              ]),
          {
            title: t("admin.team.role"),
            hint: t("admin.team.roleHint"),
            valid: true,
            content: (
              <WizardChoices
                name="staff-role"
                value={form.role}
                onChange={(value) => setForm({ ...form, role: value })}
                options={ROLES.map((value) => ({
                  value,
                  label: role(value),
                  note: t(`admin.role.${value}.note` as MessageKey),
                }))}
              />
            ),
          },
          {
            title: t("login.password"),
            hint: t(editingId ? "admin.team.passwordKeep" : "admin.team.passwordHint"),
            valid: passwordValid,
            content: (
              <>
                <PasswordField
                  id="staff-password"
                  label={t("login.password")}
                  value={form.password}
                  onChange={(password) => setForm({ ...form, password })}
                />
                <Suggestions
                  label={t("wizard.suggestions")}
                  options={[{ label: t("admin.team.generate"), value: "generate" }]}
                  onPick={() => setForm({ ...form, password: strongPassword() })}
                />
              </>
            ),
          },
          {
            title: t("wizard.review"),
            hint: t("admin.team.reviewHint"),
            valid: passwordValid,
            content: (
              <WizardReview
                rows={[
                  { label: t("admin.team.name"), value: form.name.trim() },
                  { label: t("admin.login.username"), value: form.username.trim().toLowerCase() },
                  { label: t("admin.team.role"), value: role(form.role) },
                  {
                    label: t("login.password"),
                    value: form.password || t("admin.team.passwordUnchanged"),
                  },
                ]}
              />
            ),
          },
        ]}
      />
    </>
  );
}

type Action = "trash" | "restore" | "purge";

function MemberRow({
  member,
  mine,
  roleLabel,
  onEdit,
  onChange,
}: {
  member: Member;
  mine: boolean;
  roleLabel: string;
  /** Only live members can be edited. */
  onEdit?: () => void;
  onChange: (result: Result) => void;
}): React.JSX.Element {
  const { t } = usePreferences();
  const toast = useToast();
  const [which, setWhich] = useState<Action>("trash");
  const { run, pending } = useAsyncAction(async (action: Action): Promise<void> => {
    const result = requireResult(
      await adminCall<Result>(`/api/admin/staff/${member.id}`, "POST", { action }),
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

  if (member.deletedAt) {
    return (
      <li className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-dashed border-border px-4 py-3 text-sm">
        <span className="text-muted">
          {member.name} · {roleLabel}
        </span>
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
    <li className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-xl border border-border px-4 py-3 text-sm">
      <span className="min-w-0">
        <span className="font-semibold">{member.name}</span>
        {mine ? <span className="text-muted"> · {t("admin.team.you")}</span> : null}
        <span className="block text-muted">
          {member.username} · {roleLabel}
        </span>
      </span>
      <span className="flex gap-4 font-semibold">
        <button type="button" className="min-h-11 text-accent" onClick={onEdit}>
          {t("common.edit")}
        </button>
        {mine ? null : (
          <RowButton
            pending={pending}
            pendingLabel={t("common.deleting")}
            className="min-h-11 text-muted"
            onClick={() => start("trash")}
          >
            {t("common.moveToBin")}
          </RowButton>
        )}
      </span>
    </li>
  );
}
