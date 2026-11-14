"use client";

import { useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

import { notifyNewInsights, setAppBadge } from "@/components/notifications/useNotifications";
import { OnboardingGate } from "@/components/onboarding/OnboardingGate";
import { usePreferences } from "@/components/providers/PreferencesProvider";
import { Logo } from "@/components/ui/icons";
import { load, SIGNED_OUT_EVENT } from "@/lib/api-client";
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
  refresh: () => void;
}

const OverviewContext = createContext<OverviewValue>({
  overview: null,
  me: null,
  refresh: () => undefined,
});

/** Shared account summary for the signed-in area: balance, estimate, unread insights. */
export function OverviewProvider({ children }: { children: React.ReactNode }): React.JSX.Element {
  const { locale } = usePreferences();
  const router = useRouter();
  const [overview, setOverview] = useState<Overview | null>(null);
  const [me, setMe] = useState<Me | null>(null);
  const [tick, setTick] = useState(0);

  // Asked for alongside the account state, not after it: if the terms are still to be
  // accepted the server refuses and nothing is shown, and it is asked again once they are.
  const accepted = me?.termsAccepted;

  useEffect(() => {
    if (accepted === false) return;
    let cancelled = false;
    // The dashboard is the landing screen: start its data now so it is there when it draws.
    if (window.location.pathname === "/dashboard") {
      void load(`/api/dashboard?locale=${locale}`).catch(() => undefined);
    }
    load<Overview>(`/api/overview?locale=${locale}`)
      .then((data) => {
        if (!cancelled) setOverview(data);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [locale, tick, accepted]);

  useEffect(() => {
    let cancelled = false;
    load<Me>("/api/me")
      .then((data) => {
        if (!cancelled) setMe(data);
      })
      .catch(() => undefined);
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
  const value = useMemo(() => ({ overview, me, refresh }), [overview, me, refresh]);
  return (
    <OverviewContext.Provider value={value}>
      {/* Nothing of the customer's is shown until the terms are accepted. */}
      {me === null ? (
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
