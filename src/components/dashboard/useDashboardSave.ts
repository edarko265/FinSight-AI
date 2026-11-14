"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { DASHBOARD_CHANGED } from "@/components/chat/PinnableChat";
import { createSaveQueue, type SaveQueue } from "@/components/dashboard/save-queue";
import { useToast } from "@/components/providers/ToastProvider";
import { api } from "@/lib/api-client";
import { isApiError } from "@/lib/async-action";
import type { DashboardPayload, DashboardState, DashboardWidget } from "@/lib/contracts/chart";

/**
 * The cards to draw for `state`, reusing the cards the server last calculated. Order, size,
 * collapsed and removals show at once. A card the server has not calculated yet (a new
 * widget, another view's) is missing until the save answers.
 */
export function cardsFor(
  state: DashboardState,
  payload: Pick<DashboardPayload, "activeId" | "cards">,
): DashboardWidget[] {
  if (state.activeId !== payload.activeId) return payload.cards;
  const view = state.views.find((item) => item.id === state.activeId);
  if (!view) return payload.cards;
  const known = new Map(payload.cards.map((card) => [card.id, card]));
  return view.widgets.flatMap((widget) => {
    const card = known.get(widget.id);
    return card
      ? [{ ...card, size: widget.size ?? card.size, collapsed: widget.collapsed ?? false }]
      : [];
  });
}

export interface DashboardSave {
  /** Null until the first load. Views and cards already include unsaved changes. */
  dashboard: DashboardPayload | null;
  saving: boolean;
  loadFailed: boolean;
  /** True once the user has pressed retry. */
  retried: boolean;
  retry: () => void;
  /** Applies a change to the latest state. Resolves true once a save containing it succeeded. */
  update: (change: (state: DashboardState) => DashboardState) => Promise<boolean>;
}

/** Loads the dashboard and saves edits optimistically, with coalesced writes. */
export function useDashboardSave(locale: string): DashboardSave {
  const toast = useToast();
  const [payload, setPayload] = useState<DashboardPayload | null>(null);
  const [state, setState] = useState<DashboardState | null>(null);
  const [saving, setSaving] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const [retried, setRetried] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const latest = useRef({ toast, locale });

  useEffect(() => {
    latest.current = { toast, locale };
  });

  const [queue] = useState<SaveQueue<DashboardState>>(() =>
    createSaveQueue<DashboardState, DashboardPayload>({
      save: (next) =>
        api<DashboardPayload>(`/api/dashboard?locale=${latest.current.locale}`, {
          method: "PUT",
          json: next,
        }),
      onChange: (desired, busy) => {
        setState(desired);
        setSaving(busy);
      },
      onSaved: setPayload,
      onFailed: (error) => {
        if (!isApiError(error, 401)) latest.current.toast.fail("common.saveFailed");
      },
    }),
  );

  /** Fetches once nothing is being saved, so a reload never overwrites unsaved edits. */
  const fetchSettled = useCallback(async (): Promise<DashboardPayload> => {
    for (;;) {
      await queue.idle();
      const version = queue.version();
      const data = await api<DashboardPayload>(`/api/dashboard?locale=${locale}`);
      if (!queue.busy() && version === queue.version()) return data;
    }
  }, [queue, locale]);

  const adopt = useCallback(
    (data: DashboardPayload): void => {
      setPayload(data);
      queue.reset({ activeId: data.activeId, views: data.views });
    },
    [queue],
  );

  useEffect(() => {
    let cancelled = false;
    fetchSettled()
      .then((data) => {
        if (cancelled) return;
        adopt(data);
        setLoadFailed(false);
      })
      .catch((error: unknown) => {
        if (!cancelled && !isApiError(error, 401)) setLoadFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [fetchSettled, adopt, attempt]);

  // A chart pinned from the floating coach changes the dashboard open behind it.
  useEffect(() => {
    let cancelled = false;
    const reload = (): void => {
      fetchSettled()
        .then((data) => {
          if (!cancelled) adopt(data);
        })
        .catch(() => undefined);
    };
    window.addEventListener(DASHBOARD_CHANGED, reload);
    return () => {
      cancelled = true;
      window.removeEventListener(DASHBOARD_CHANGED, reload);
    };
  }, [fetchSettled, adopt]);

  const retry = useCallback((): void => {
    setLoadFailed(false);
    setRetried(true);
    setAttempt((value) => value + 1);
  }, []);

  const update = useCallback(
    (change: (current: DashboardState) => DashboardState): Promise<boolean> => queue.change(change),
    [queue],
  );

  const dashboard =
    payload && state
      ? {
          ...payload,
          activeId: state.activeId,
          views: state.views,
          cards: cardsFor(state, payload),
        }
      : null;
  return { dashboard, saving, loadFailed, retried, retry, update };
}
