"use client";

import { useCallback, useEffect, useState } from "react";

import { adminCall } from "@/components/admin/admin-api";

/**
 * Loads one admin route. `data` stays null until it arrives; `failed` is set when it could not
 * be fetched (retry with `reload`). `setData` applies the fresh list an action returns.
 */
export function useAdminLoad<T>(path: string): {
  data: T | null;
  failed: boolean;
  reload: () => void;
  setData: (value: T) => void;
} {
  const [data, setData] = useState<T | null>(null);
  const [failed, setFailed] = useState(false);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    void adminCall<T>(path).then((result) => {
      if (cancelled) return;
      if (result === null) setFailed(true);
      else setData(result);
    });
    return () => {
      cancelled = true;
    };
  }, [path, tick]);

  const reload = useCallback(() => {
    setFailed(false);
    setTick((value) => value + 1);
  }, []);

  return { data, failed, reload, setData };
}
