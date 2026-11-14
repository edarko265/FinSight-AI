"use client";

import { useEffect, useState } from "react";

import { usePreferences } from "@/components/providers/PreferencesProvider";
import { useToast } from "@/components/providers/ToastProvider";
import { api } from "@/lib/api-client";
import { formatDay } from "@/lib/i18n/config";
import { hasMessage, type MessageKey } from "@/lib/i18n/translate";

interface TrashEntry {
  id: string;
  kind: "goal" | "plan" | "view" | "widget";
  label: string;
  deletedAt: string;
}

/** The customer's recycle bin: restore a deleted goal, view or widget, or delete it for good. */
export function TrashView(): React.JSX.Element {
  const { t, locale } = usePreferences();
  const toast = useToast();
  const [items, setItems] = useState<TrashEntry[] | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    api<{ items: TrashEntry[] }>("/api/trash")
      .then((data) => {
        if (!cancelled) setItems(data.items);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [tick]);

  async function act(
    payload: { id: string; action: "restore" | "delete" } | { action: "empty" },
  ): Promise<void> {
    await api("/api/trash", { method: "POST", json: payload }).catch(() => undefined);
    toast.notify(
      payload.action === "restore"
        ? "toast.restored"
        : payload.action === "empty"
          ? "toast.binEmptied"
          : "toast.deleted",
    );
    setTick((value) => value + 1);
  }

  /** Built-in views and widgets are stored by key; show their translated names. */
  const label = (item: TrashEntry): string => {
    const key = item.kind === "view" ? `views.preset.${item.label}` : `admin.topic.${item.label}`;
    return item.kind !== "goal" && item.kind !== "plan" && hasMessage(key) ? t(key) : item.label;
  };

  return (
    <div className="flex flex-col gap-4 px-4 py-4">
      <div>
        <h1 className="text-xl font-semibold">{t("trash.title")}</h1>
        <p className="mt-1 text-sm text-muted">{t("trash.intro")}</p>
      </div>

      {items && items.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted">
          {t("trash.empty")}
        </p>
      ) : null}

      <ul className="flex flex-col gap-2">
        {items?.map((item) => (
          <li key={item.id} className="rounded-2xl border border-border bg-surface p-4">
            <p className="text-sm font-semibold">{label(item)}</p>
            <p className="text-xs text-muted">
              {t(`trash.kind.${item.kind}` as MessageKey)} ·{" "}
              {formatDay(item.deletedAt.slice(0, 10), locale)}
            </p>
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                onClick={() => void act({ id: item.id, action: "restore" })}
                className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-on-primary"
              >
                {t("common.restore")}
              </button>
              <button
                type="button"
                onClick={() => void act({ id: item.id, action: "delete" })}
                className="rounded-full border border-border px-4 py-2 text-sm font-semibold text-warning"
              >
                {t("common.deleteForever")}
              </button>
            </div>
          </li>
        ))}
      </ul>

      {items && items.length > 1 ? (
        <button
          type="button"
          onClick={() => void act({ action: "empty" })}
          className="self-start text-sm font-semibold text-warning"
        >
          {t("trash.emptyAll")}
        </button>
      ) : null}
    </div>
  );
}
