"use client";

import { useEffect, useRef, useState } from "react";

import { formatMoney, type Locale } from "@/lib/i18n/config";

const DURATION_MS = 700;

/** A money amount that counts up to its value when it first appears or changes. */
export function CountUp({ cents, locale }: { cents: number; locale: Locale }): React.JSX.Element {
  const [shown, setShown] = useState(cents);
  const from = useRef(0);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- jump straight to the value when motion is reduced
      setShown(cents);
      return;
    }
    const start = performance.now();
    const origin = from.current;
    let frame = 0;
    const tick = (now: number): void => {
      const progress = Math.min(1, (now - start) / DURATION_MS);
      const eased = 1 - Math.pow(1 - progress, 3);
      setShown(Math.round(origin + (cents - origin) * eased));
      if (progress < 1) frame = requestAnimationFrame(tick);
      else from.current = cents;
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [cents]);

  return <span aria-label={formatMoney(cents, locale)}>{formatMoney(shown, locale)}</span>;
}
