"use client";

import { useCallback, useEffect, useReducer, useRef } from "react";

import { loadReducer, initialLoadState, type LoadState } from "@/components/shared/load-state";
import { isApiError } from "@/lib/async-action";

/**
 * Loads data for a screen: `data` is null until the first success, `failed` is set when a
 * load rejects (a 401 is ignored, `api()` already signs the user out) and `retry` loads
 * again, clearing `failed` and setting `loading` so the screen can show its skeleton.
 * Data from an earlier success stays visible while the same key reloads. When `key` changes
 * (for example the locale) data and failure are reset and the load runs again.
 *
 * Attach `headingRef` to the page heading (with `tabIndex={-1}`): after a retry succeeds,
 * focus moves there if it would otherwise have dropped to the page body.
 */
export function useLoad<T>(
  load: () => Promise<T>,
  key: unknown = null,
): {
  data: T | null;
  failed: boolean;
  loading: boolean;
  retry: () => void;
  setData: (update: (current: T | null) => T | null) => void;
  headingRef: React.RefObject<HTMLHeadingElement | null>;
} {
  const [raw, dispatch] = useReducer(
    (state: LoadState<T>, action: Parameters<typeof loadReducer<T>>[1]) =>
      loadReducer(state, action),
    key,
    (initial: unknown) => initialLoadState<T>(initial),
  );
  // Derived during render, so the very first render after a key change already shows no old data.
  const state = Object.is(raw.key, key) ? raw : initialLoadState<T>(key);
  const latest = useRef(load);
  const retried = useRef(false);
  const headingRef = useRef<HTMLHeadingElement | null>(null);
  const [tick, bump] = useReducer((value: number) => value + 1, 0);

  useEffect(() => {
    latest.current = load;
  });

  useEffect(() => {
    let cancelled = false;
    latest
      .current()
      .then((data) => {
        if (cancelled) return;
        dispatch({ type: "success", key, data });
        if (retried.current) {
          retried.current = false;
          const active = document.activeElement;
          if (!active || active === document.body) headingRef.current?.focus();
        }
      })
      .catch((error: unknown) => {
        if (!cancelled && !isApiError(error, 401)) dispatch({ type: "failure", key });
      });
    return () => {
      cancelled = true;
    };
  }, [key, tick]);

  const retry = useCallback(() => {
    retried.current = true;
    dispatch({ type: "start", key });
    bump();
  }, [key]);

  const setData = useCallback(
    (update: (current: T | null) => T | null) => dispatch({ type: "update", key, update }),
    [key],
  );

  return {
    data: state.data,
    failed: state.failed,
    loading: state.loading,
    retry,
    setData,
    headingRef,
  };
}
