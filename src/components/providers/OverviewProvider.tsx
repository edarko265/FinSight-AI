"use client";

import { useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

import { notifyNewInsights, setAppBadge } from "@/components/notifications/useNotifications";
import { OnboardingGate } from "@/components/onboarding/OnboardingGate";
import { usePreferences } from "@/components/providers/PreferencesProvider";
import { Logo } from "@/components/ui/icons";
import { LoadError } from "@/components/ui/LoadError";
import { api, SIGNED_OUT_EVENT } from "@/lib/api-client";
import { translate } from "@/lib/i18n/translate";

export interface Overview {
  asOf: string;
  balanceCents: number;
  forecast: {
    status: "ok" | "shortfall" | "insufficient_data";
    availableCents: number;
    shortfallCents: number;
    horizonDays: number;
  };
  unreadInsights: number;
}

export interface Me {
  customerId: string;
  asOf: string;
  aiEnabled: boolean;
  aiConsent: boolean;
  /** False until the customer accepts the terms of use and privacy notice. */
  termsAccepted: boolean;
  /** True once the customer has said yes or no to the AI coach. */
  aiDecided: boolean;
  voiceEnabled: boolean;
  voiceAgentEnabled: boolean;
  advisorEnabled: boolean;
  rewardsEnabled: boolean;
}

interface OverviewValue {
  overview: Overview | null;
  me: Me | null;
  /** True until the first overview has arrived or failed. */
  overviewLoading: boolean;
  /** True when the overview could not be loaded and there is none to show. */
  overviewFailed: boolean;
  refresh: () => void;
}

const OverviewContext = createContext<OverviewValue>({
  overview: null,
  me: null,
  overviewLoading: false,
  overviewFailed: false,
  refresh: () => undefined,
});

/** Shared account summary for the signed-in area: balance, estimate, unread insights. */
export function OverviewProvider({ children }: { children: React.ReactNode }): React.JSX.Element {
  const { locale } = usePreferences();
  const router = useRouter();
  const [overview, setOverview] = useState<Overview | null>(null);
  const [me, setMe] = useState<Me | null>(null);
  const [overviewFailed, setOverviewFailed] = useState(false);
  const [meFailed, setMeFailed] = useState(false);
  const [tick, setTick] = useState(0);

  const ready = me?.termsAccepted === true;

  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    api<Overview>(`/api/overview?locale=${locale}`)
      .then((data) => {
        if (cancelled) return;
        setOverview(data);
        setOverviewFailed(false);
      })
      .catch(() => {
        if (!cancelled) setOverviewFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [locale, tick, ready]);

  useEffect(() => {
    let cancelled = false;
    api<Me>("/api/me")
      .then((data) => {
        if (cancelled) return;
        setMe(data);
        setMeFailed(false);
      })
      .catch(() => {
        if (!cancelled) setMeFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [tick]);

  useEffect(() => {
    const toSignIn = (): void => router.replace("/login");
    window.addEventListener(SIGNED_OUT_EVENT, toSignIn);
    return () => window.removeEventListener(SIGNED_OUT_EVENT, toSignIn);
  }, [router]);

  // Keep the home-screen badge in step, and tell the device when new insights appear.
  const unread = overview?.unreadInsights;
  useEffect(() => {
    if (unread === undefined) return;
    setAppBadge(unread);
    void notifyNewInsights(
      unread,
      translate(locale, "notify.insight.title"),
      translate(locale, "notify.insight.body", { count: unread }),
    );
  }, [unread, locale]);

  const refresh = useCallback(() => setTick((value) => value + 1), []);
  const overviewLoading = ready && overview === null && !overviewFailed;
  const value = useMemo(
    () => ({
      overview,
      me,
      overviewLoading,
      overviewFailed: overview === null && overviewFailed,
      refresh,
    }),
    [overview, me, overviewLoading, overviewFailed, refresh],
  );
  return (
    <OverviewContext.Provider value={value}>
      {/* Nothing of the customer's is shown until the terms are accepted. */}
      {me === null && meFailed ? (
        <div className="flex min-h-dvh flex-1 items-center justify-center px-4">
          <LoadError
            className="w-full max-w-sm"
            onRetry={() => {
              setMeFailed(false);
              refresh();
            }}
          />
        </div>
      ) : me === null ? (
        <div
          className="flex min-h-dvh flex-1 items-center justify-center"
          role="status"
          aria-label="FinSight-AI"
        >
          <Logo className="size-16 animate-pulse" />
        </div>
      ) : !me.termsAccepted ? (
        <OnboardingGate aiAvailable={me.aiEnabled} onDone={refresh} />
      ) : (
        children
      )}
    </OverviewContext.Provider>
  );
}

export function useOverview(): OverviewValue {
  return useContext(OverviewContext);
}
