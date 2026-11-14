"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { useToast } from "@/components/providers/ToastProvider";
import {
  createAsyncAction,
  isApiError,
  type AsyncAction,
  type AsyncResult,
} from "@/lib/async-action";
import type { MessageKey, MessageParams } from "@/lib/i18n/translate";

/**
 * Runs an async action with a pending flag, a double-run guard and toasts.
 *
 * Usage rules:
 * - One hook per form or button. Per-item actions use a row component with its own hook;
 *   bulk actions use one hook at list level.
 * - While `pending`, set `aria-disabled` on the control and ignore the click rather than
 *   using `disabled`, so keyboard focus stays where it is.
 * - A second `run` while pending resolves to `{ ok: false, dropped: true }` with no toast.
 * - `run` never rejects; check `result.ok`. The success toast fires only after the promise
 *   resolves, and also after unmount (by design). A 401 shows no error toast, because
 *   `api()` already signs the user out.
 */
export function useAsyncAction<A extends unknown[], T>(
  fn: (...args: A) => Promise<T>,
  {
    successKey,
    successParams,
    errorKey,
  }: {
    /** Toast shown after the promise resolves, never before. */
    successKey?: MessageKey;
    successParams?: MessageParams;
    /** Toast on failure: a key, or a function choosing one per error (`null` = no toast). Defaults to the generic error toast. */
    errorKey?: MessageKey | ((error: unknown) => MessageKey | null);
  } = {},
): { run: (...args: A) => Promise<AsyncResult<T>>; pending: boolean } {
  const toast = useToast();
  const [pending, setPending] = useState(false);
  const latest = useRef({ fn, toast, successKey, successParams, errorKey });
  const mounted = useRef(true);

  useEffect(() => {
    latest.current = { fn, toast, successKey, successParams, errorKey };
  });
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const action = useRef<AsyncAction<A, T> | null>(null);

  // Built on first call, so refs are only read outside of render.
  const run = useCallback((...args: A): Promise<AsyncResult<T>> => {
    action.current ??= createAsyncAction((...inner: A) => latest.current.fn(...inner), {
      onPending: (value) => {
        if (mounted.current) setPending(value);
      },
      onSuccess: () => {
        const { toast: current, successKey: key, successParams: params } = latest.current;
        if (key) current.notify(key, params);
      },
      onError: (error) => {
        if (isApiError(error, 401)) return;
        const { toast: current, errorKey: key } = latest.current;
        const resolved = typeof key === "function" ? key(error) : key;
        if (resolved === null) return;
        current.fail(resolved);
      },
    });
    return action.current.run(...args);
  }, []);

  return { run, pending };
}
