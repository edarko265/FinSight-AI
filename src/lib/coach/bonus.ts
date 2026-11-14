import "server-only";

import { randomBytes } from "node:crypto";

import { readState, writeState } from "@/lib/data/repository";

/**
 * The link to a bonus programme.
 *
 * SIMULATED. A real deployment would hand a redeemed reward to the bank's
 * bonus programme and get a voucher back. No such connection exists here, so
 * the provider below issues a made-up code and every screen says so. The
 * interface is what the real connection would implement.
 */
export interface BonusProvider {
  id: string;
  simulated: boolean;
  issue(couponId: string): Promise<{ code: string }>;
}

export const simulatedBonus: BonusProvider = {
  id: "simulated",
  simulated: true,
  async issue() {
    return { code: `DEMO-${randomBytes(3).toString("hex").toUpperCase()}` };
  },
};

export const bonusProvider = (): BonusProvider => simulatedBonus;

export interface Redemption {
  id: string;
  couponId: string;
  code: string;
  /** The month it was redeemed in: a reward can be redeemed once a month. */
  month: string;
  simulated: boolean;
}

const KIND = "redemptions";

export async function listRedemptions(ref: string): Promise<Redemption[]> {
  return (await readState<Redemption[]>(ref, KIND)) ?? [];
}

export async function redeem(
  ref: string,
  couponId: string,
  asOf: string,
): Promise<Redemption | "already"> {
  const month = asOf.slice(0, 7);
  const all = await listRedemptions(ref);
  if (all.some((item) => item.couponId === couponId && item.month === month)) return "already";
  const provider = bonusProvider();
  const { code } = await provider.issue(couponId);
  const redemption: Redemption = {
    id: `redeem-${crypto.randomUUID()}`,
    couponId,
    code,
    month,
    simulated: provider.simulated,
  };
  await writeState(ref, KIND, [redemption, ...all].slice(0, 60));
  return redemption;
}
