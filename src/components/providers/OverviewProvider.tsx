"use client";

import { useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

import { notifyNewInsights, setAppBadge } from "@/components/notifications/useNotifications";
import { FocusedRegion } from "@/components/dashboard/FocusedRegion";
import { OnboardingGate } from "@/components/onboarding/OnboardingGate";
import { usePreferences } from "@/components/providers/PreferencesProvider";
import { Logo } from "@/components/ui/icons";
import { LoadError } from "@/components/ui/LoadError";
import { api, load, SIGNED_OUT_EVENT } from "@/lib/api-client";
import { isApiError } from "@/lib/async-action";
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
  /** Dashboard card visibility, so the header can keep its balance available while scrolling. */
  dashboardBalanceVisible: boolean;
  setDashboardBalanceVisible: (visible: boolean) => void;
  refresh: () => void;
}

const OverviewContext = createContext<OverviewValue>({
  overview: null,
  me: null,
  overviewLoading: false,
  overviewFailed: false,
  dashboardBalanceVisible: true,
  setDashboardBalanceVisible: () => undefined,
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
  const [meRetried, setMeRetried] = useState(false);
  const [dashboardBalanceVisible, setDashboardBalanceVisible] = useState(true);
  const [tick, setTick] = useState(0);

  // Asked for alongside the account state, not after it: if the terms are still to be
  // accepted the server refuses and nothing is shown, and it is asked again once they are.
  const accepted = me?.termsAccepted;
  const ready = accepted === true;

  useEffect(() => {
    if (accepted === false) return;
    let cancelled = false;
    // The dashboard is the landing screen: start its data now so it is there when it draws.
    if (window.location.pathname === "/dashboard") {
      void load(`/api/dashboard?locale=${locale}`).catch(() => undefined);
    }
    load<Overview>(`/api/overview?locale=${locale}`)
      .then((data) => {
        if (cancelled) return;
        setOverview(data);
        setOverviewFailed(false);
      })
      .catch((error: unknown) => {
        // A 401 has already signed the user out.
        if (!cancelled && !isApiError(error, 401)) setOverviewFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [locale, tick, accepted]);

  useEffect(() => {
    let cancelled = false;
    load<Me>("/api/me")
      .then((data) => {
        if (cancelled) return;
        setMe(data);
        setMeFailed(false);
      })
      .catch((error: unknown) => {
        if (!cancelled && !isApiError(error, 401)) setMeFailed(true);
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

  // Clearing the failures shows the loading state again, so a retry visibly does something.
  const refresh = useCallback(() => {
    setOverviewFailed(false);
    setMeFailed(false);
    setTick((value) => value + 1);
  }, []);
  const overviewLoading = ready && overview === null && !overviewFailed;
  const value = useMemo(
    () => ({
      overview,
      me,
      overviewLoading,
      overviewFailed: overview === null && overviewFailed,
      dashboardBalanceVisible,
      setDashboardBalanceVisible,
      refresh,
    }),
    [overview, me, overviewLoading, overviewFailed, dashboardBalanceVisible, refresh],
  );
  return (
    <OverviewContext.Provider value={value}>
      {/* Nothing of the customer's is shown until the terms are accepted. */}
      {me === null && meFailed ? (
        <div className="flex min-h-dvh flex-1 items-center justify-center px-4">
          <LoadError
            className="w-full max-w-sm"
            onRetry={() => {
              setMeRetried(true);
              refresh();
            }}
          />
        </div>
      ) : me === null ? (
        <FocusedRegion focus={meRetried} className="flex min-h-dvh flex-1">
          <div
            className="flex flex-1 items-center justify-center"
            role="status"
            aria-label="FinSight-AI"
          >
            <Logo className="size-16 animate-pulse" />
          </div>
        </FocusedRegion>
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
