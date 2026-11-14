"use client";

import { usePreferences } from "@/components/providers/PreferencesProvider";
import { useLoad } from "@/components/shared/useLoad";
import { LoadError } from "@/components/ui/LoadError";
import { LoadingRegion, SkeletonList } from "@/components/ui/Skeleton";
import { PendingLabel } from "@/components/ui/Spinner";
import { useAsyncAction } from "@/components/ui/useAsyncAction";
import { api } from "@/lib/api-client";
import { formatDay, formatMoney } from "@/lib/i18n/config";
import { hasMessage, type MessageKey } from "@/lib/i18n/translate";
import { InfoTip } from "@/components/ui/InfoTip";

interface TrashEntry {
  id: string;
  kind: "goal" | "plan" | "account" | "setaside" | "view" | "widget";
  label: string;
  deletedAt: string;
}

type TrashAction = { id: string; action: "restore" | "delete" } | { action: "empty" };

const SUCCESS = {
  restore: "toast.restored",
  delete: "toast.deleted",
  empty: "toast.binEmptied",
} as const;

/** The customer's recycle bin: restore a deleted goal, view or widget, or delete it for good. */
export function TrashView(): React.JSX.Element {
  const { t, locale } = usePreferences();
  const { data, failed, retry } = useLoad(() => api<{ items: TrashEntry[] }>("/api/trash"));
  const items = data?.items ?? null;

  const empty = useAsyncAction(
    () => api("/api/trash", { method: "POST", json: { action: "empty" } satisfies TrashAction }),
    { successKey: SUCCESS.empty },
  );

  async function emptyAll(): Promise<void> {
    const result = await empty.run();
    if (result.ok) retry();
  }

  /** Built-in views and widgets are stored by key; show their translated names. */
  const label = (item: TrashEntry): string => {
    const key = item.kind === "view" ? `views.preset.${item.label}` : `admin.topic.${item.label}`;
    if (item.kind === "setaside") return formatMoney(Number(item.label), locale);
    return item.kind === "view" || item.kind === "widget"
      ? hasMessage(key)
        ? t(key)
        : item.label
      : item.label;
  };

  return (
    <div className="flex flex-col gap-4 px-4 py-4">
      <div>
        <InfoTip lead={<h1 className="text-xl font-semibold">{t("trash.title")}</h1>}>
          {t("trash.intro")}
        </InfoTip>
      </div>

      {failed ? <LoadError onRetry={retry} /> : null}
      {!items && !failed ? (
        <LoadingRegion>
          <SkeletonList rows={3} />
        </LoadingRegion>
      ) : null}

      {items && items.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted">
          {t("trash.empty")}
        </p>
      ) : null}

      <ul className="flex flex-col gap-2">
        {items?.map((item) => (
          <TrashRow key={item.id} item={item} name={label(item)} onDone={retry} />
        ))}
      </ul>

      {items && items.length > 1 ? (
        <button
          type="button"
          aria-disabled={empty.pending}
          onClick={() => void emptyAll()}
          className="min-h-11 self-start text-sm font-semibold text-warning"
        >
          {empty.pending ? (
            <PendingLabel>{t("common.deleting")}</PendingLabel>
          ) : (
            t("trash.emptyAll")
          )}
        </button>
      ) : null}
    </div>
  );
}

/** One bin entry. It owns its hooks so each row shows its own pending state. */
function TrashRow({
  item,
  name,
  onDone,
}: {
  item: TrashEntry;
  name: string;
  onDone: () => void;
}): React.JSX.Element {
  const { t, locale } = usePreferences();
  const restore = useAsyncAction(
    () =>
      api("/api/trash", {
        method: "POST",
        json: { id: item.id, action: "restore" } satisfies TrashAction,
      }),
    { successKey: SUCCESS.restore },
  );
  const remove = useAsyncAction(
    () =>
      api("/api/trash", {
        method: "POST",
        json: { id: item.id, action: "delete" } satisfies TrashAction,
      }),
    { successKey: SUCCESS.delete },
  );
  const busy = restore.pending || remove.pending;

  async function act(run: () => Promise<{ ok: boolean }>): Promise<void> {
    if (busy) return;
    const result = await run();
    if (result.ok) onDone();
  }

  return (
    <li className="rounded-2xl border border-border bg-surface p-4">
      <p className="text-sm font-semibold">{name}</p>
      <p className="text-sm text-muted">
        {t(`trash.kind.${item.kind}` as MessageKey)} ·{" "}
        {formatDay(item.deletedAt.slice(0, 10), locale)}
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          aria-disabled={busy}
          onClick={() => void act(restore.run)}
          className="min-h-11 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-on-primary"
        >
          {restore.pending ? (
            <PendingLabel>{t("common.restoring")}</PendingLabel>
          ) : (
            t("common.restore")
          )}
        </button>
        <button
          type="button"
          aria-disabled={busy}
          onClick={() => void act(remove.run)}
          className="min-h-11 rounded-full border border-border px-4 py-2 text-sm font-semibold text-warning"
        >
          {remove.pending ? (
            <PendingLabel>{t("common.deleting")}</PendingLabel>
          ) : (
            t("common.deleteForever")
          )}
        </button>
      </div>
    </li>
  );
}
