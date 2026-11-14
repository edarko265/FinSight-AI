"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { useToast } from "@/components/providers/ToastProvider";
import { createAsyncAction, type AsyncAction, type AsyncResult } from "@/lib/async-action";
import type { MessageKey } from "@/lib/i18n/translate";

interface UseAsyncActionOptions {
  /** Toast shown after the promise resolves, never before. */
  successKey?: MessageKey;
  /** Toast shown on failure. Defaults to the generic error toast. */
  errorKey?: MessageKey;
}

/** Runs an async action with a pending flag, a double-run guard and success or failure toasts. */
export function useAsyncAction<A extends unknown[], T>(
  fn: (...args: A) => Promise<T>,
  { successKey, errorKey }: UseAsyncActionOptions = {},
): { run: (...args: A) => Promise<AsyncResult<T>>; pending: boolean } {
  const toast = useToast();
  const [pending, setPending] = useState(false);
  const latest = useRef({ fn, toast, successKey, errorKey });
  const mounted = useRef(true);

  useEffect(() => {
    latest.current = { fn, toast, successKey, errorKey };
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
        const { toast: current, successKey: key } = latest.current;
        if (key) current.notify(key);
      },
      onError: () => latest.current.toast.fail(latest.current.errorKey),
    });
    return action.current.run(...args);
  }, []);
  return { run, pending };
}
