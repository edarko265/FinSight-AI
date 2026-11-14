"use client";

import { useCallback, useEffect, useState } from "react";

import { adminCall } from "@/components/admin/admin-api";
import { isApiError } from "@/lib/async-action";

interface Loaded<T> {
  path: string;
  data: T | null;
  failed: boolean;
}

/**
 * Loads one admin route. `data` stays null until it arrives; `failed` is set when it could not
 * be fetched (retry with `reload`). `setData` applies the fresh list an action returns. A 401
 * is no failure: the shell is already sending the user to sign in. Changing `path` starts over.
 */
export function useAdminLoad<T>(path: string): {
  data: T | null;
  failed: boolean;
  reload: () => void;
  setData: (value: T) => void;
} {
  const [state, setState] = useState<Loaded<T>>({ path, data: null, failed: false });
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    adminCall<T>(path)
      .then((result) => {
        if (cancelled) return;
        setState((current) =>
          result === null
            ? { path, data: current.path === path ? current.data : null, failed: true }
            : { path, data: result, failed: false },
        );
      })
      .catch((error: unknown) => {
        if (!cancelled && !isApiError(error, 401)) {
          setState((current) => ({
            path,
            data: current.path === path ? current.data : null,
            failed: true,
          }));
        }
      });
    return () => {
      cancelled = true;
    };
  }, [path, tick]);

  const reload = useCallback(() => {
    setState((current) => ({ ...current, failed: false }));
    setTick((value) => value + 1);
  }, []);
  const setData = useCallback((value: T) => setState({ path, data: value, failed: false }), [path]);

  const here = state.path === path;
  return { data: here ? state.data : null, failed: here && state.failed, reload, setData };
}
