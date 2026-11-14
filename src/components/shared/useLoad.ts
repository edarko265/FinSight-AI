"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { isApiError } from "@/lib/async-action";

/**
 * Loads data for a screen: `data` is null until the first success, `failed` is set when a
 * load rejects (a 401 is ignored, `api()` already signs the user out) and `retry` loads
 * again. Data from an earlier success stays visible while a reload runs or fails.
 * `key` re-runs the load when it changes, for example the locale.
 */
export function useLoad<T>(
  load: () => Promise<T>,
  key: unknown = null,
): {
  data: T | null;
  failed: boolean;
  retry: () => void;
  setData: React.Dispatch<React.SetStateAction<T | null>>;
} {
  const [data, setData] = useState<T | null>(null);
  const [failed, setFailed] = useState(false);
  const [tick, setTick] = useState(0);
  const latest = useRef(load);

  useEffect(() => {
    latest.current = load;
  });

  useEffect(() => {
    let cancelled = false;
    latest
      .current()
      .then((value) => {
        if (cancelled) return;
        setData(value);
        setFailed(false);
      })
      .catch((error: unknown) => {
        if (!cancelled && !isApiError(error, 401)) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [key, tick]);

  // `failed` stays set until the retry succeeds, so the error and its button keep focus.
  const retry = useCallback(() => {
    setTick((value) => value + 1);
  }, []);

  return { data, failed, retry, setData };
}
