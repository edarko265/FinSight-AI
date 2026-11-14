"use client";

import { useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

import { OnboardingGate } from "@/components/onboarding/OnboardingGate";
import { usePreferences } from "@/components/providers/PreferencesProvider";
import { api, SIGNED_OUT_EVENT } from "@/lib/api-client";

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

  const ready = me?.termsAccepted === true;

  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    api<Overview>(`/api/overview?locale=${locale}`)
      .then((data) => {
        if (!cancelled) setOverview(data);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [locale, tick, ready]);

  useEffect(() => {
    let cancelled = false;
    api<Me>("/api/me")
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

  const refresh = useCallback(() => setTick((value) => value + 1), []);
  const value = useMemo(() => ({ overview, me, refresh }), [overview, me, refresh]);
  return (
    <OverviewContext.Provider value={value}>
      {/* Nothing of the customer's is shown until the terms are accepted. */}
      {me && !me.termsAccepted ? (
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
