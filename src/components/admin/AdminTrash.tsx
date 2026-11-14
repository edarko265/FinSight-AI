"use client";

import { useCallback, useEffect, useState } from "react";

import { adminCall, requireResult } from "@/components/admin/admin-api";
import { LoadState } from "@/components/admin/LoadState";
import { Panel } from "@/components/admin/parts";
import { RowButton } from "@/components/admin/RowButton";
import { usePreferences } from "@/components/providers/PreferencesProvider";
import { useToast } from "@/components/providers/ToastProvider";
import { LoadError } from "@/components/ui/LoadError";
import { PendingLabel } from "@/components/ui/Spinner";
import { useAsyncAction } from "@/components/ui/useAsyncAction";
import { hasMessage, type MessageKey } from "@/lib/i18n/translate";

type Kind = "announcement" | "request" | "staff" | "training";

interface BinItem {
  kind: Kind;
  id: string;
  label: string;
}

const PATHS: Record<Kind, string> = {
  announcement: "/api/admin/announcements",
  request: "/api/admin/advisor",
  staff: "/api/admin/staff",
  training: "/api/admin/training",
};

/**
 * One recycle bin for everything staff can delete: announcements, adviser
 * requests, team members and taught answers. Each can be restored or deleted
 * for good; nothing is deleted for good anywhere else.
 */
export function AdminTrash({ manager }: { manager: boolean }): React.JSX.Element {
  const { t } = usePreferences();
  const toast = useToast();
  const [items, setItems] = useState<BinItem[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async (): Promise<void> => {
    const theme = (name: string): string =>
      hasMessage(`admin.theme.${name}`) ? t(`admin.theme.${name}` as MessageKey) : name;
    const [announcements, queue, staff, training] = await Promise.all([
      manager
        ? adminCall<{ announcements: { id: string; title: string; deletedAt: string | null }[] }>(
            PATHS.announcement,
          )
        : null,
      adminCall<{
        queue: { id: string; alias: string; topic: string; deleted: boolean }[];
      }>(PATHS.request),
      manager
        ? adminCall<{ staff: { id: string; name: string; deletedAt: string | null }[] }>(
            PATHS.staff,
          )
        : null,
      adminCall<{
        answers: { id: string; theme: string; keywords: string[]; deletedAt: string | null }[];
      }>(PATHS.training),
    ]);
    if (!queue || !training || (manager && (!announcements || !staff))) setFailed(true);
    else setFailed(false);
    setItems([
      ...(announcements?.announcements ?? [])
        .filter((item) => item.deletedAt)
        .map((item) => ({ kind: "announcement" as const, id: item.id, label: item.title })),
      ...(queue?.queue ?? [])
        .filter((item) => item.deleted)
        .map((item) => ({
          kind: "request" as const,
          id: item.id,
          label: `${item.alias} · ${t(`advisor.topic.${item.topic}` as MessageKey)}`,
        })),
      ...(staff?.staff ?? [])
        .filter((item) => item.deletedAt)
        .map((item) => ({ kind: "staff" as const, id: item.id, label: item.name })),
      ...(training?.answers ?? [])
        .filter((item) => item.deletedAt)
        .map((item) => ({
          kind: "training" as const,
          id: item.id,
          label: [theme(item.theme), ...item.keywords].join(" · "),
        })),
    ]);
  }, [manager, t]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- loads the bin when the page opens
    void load();
  }, [load]);

  async function emptyBin(): Promise<void> {
    if (!items) return;
    if (busy) return;
    setBusy(true);
    const results = await Promise.all(
      items.map((item) => adminCall(`${PATHS[item.kind]}/${item.id}`, "POST", { action: "purge" })),
    );
    setBusy(false);
    setConfirming(false);
    if (results.some((result) => !result)) toast.fail();
    else toast.notify("toast.binEmptied");
    await load();
  }

  return (
    <Panel title={t("admin.bin")}>
      {failed && items ? (
        <LoadError onRetry={() => void load()} messageKey="admin.loadFailed" />
      ) : null}
      <LoadState show={items === null} failed={false} onRetry={() => void load()} />
      {items === null ? null : items.length === 0 ? (
        <p className="text-sm text-muted">{t("admin.bin.empty")}</p>
      ) : (
        <>
          <ul className="flex flex-col gap-2">
            {items.map((item) => (
              <TrashRow
                key={`${item.kind}-${item.id}`}
                item={item}
                label={t(`admin.trash.kind.${item.kind}` as MessageKey)}
                onDone={load}
              />
            ))}
          </ul>
          {confirming ? (
            <div
              role="alertdialog"
              aria-label={t("trash.emptyAll")}
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-warning bg-warning-soft px-4 py-3 text-sm"
            >
              <span>{t("admin.trash.confirm", { count: items.length })}</span>
              <span className="flex gap-4 font-semibold">
                <button type="button" onClick={() => setConfirming(false)}>
                  {t("common.cancel")}
                </button>
                <button
                  type="button"
                  aria-disabled={busy}
                  className="min-h-11 text-warning"
                  onClick={() => void emptyBin()}
                >
                  {busy ? (
                    <PendingLabel>{t("common.deleting")}</PendingLabel>
                  ) : (
                    t("common.deleteForever")
                  )}
                </button>
              </span>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirming(true)}
              className="self-start rounded-full border border-border px-5 py-2.5 text-sm font-semibold"
            >
              {t("trash.emptyAll")}
            </button>
          )}
        </>
      )}
      <p className="text-xs text-muted">{t("admin.trash.note")}</p>
    </Panel>
  );
}

function TrashRow({
  item,
  label,
  onDone,
}: {
  item: BinItem;
  label: string;
  onDone: () => Promise<void>;
}): React.JSX.Element {
  const { t } = usePreferences();
  const toast = useToast();
  const [which, setWhich] = useState<"restore" | "purge">("restore");
  const { run, pending } = useAsyncAction(async (action: "restore" | "purge"): Promise<void> => {
    requireResult(await adminCall(`${PATHS[item.kind]}/${item.id}`, "POST", { action }));
    toast.notify(action === "restore" ? "toast.restored" : "toast.deleted");
    await onDone();
  });
  const start = (action: "restore" | "purge"): void => {
    setWhich(action);
    void run(action);
  };
  return (
    <li className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-dashed border-border px-4 py-3 text-sm">
      <span className="min-w-0">
        <span className="block text-xs text-muted">{label}</span>
        <span className="block truncate">{item.label}</span>
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
