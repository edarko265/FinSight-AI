import { DEMO_BANKS, generateLinked, type LinkedAccount } from "@/lib/data/linked-accounts";
import type { Transaction } from "@/lib/data/types";

/**
 * Where the transactions of an account at another bank come from.
 *
 * A real connection would implement this against an account-information
 * service (PSD2): send the customer to their bank to approve read-only
 * access, keep the consent, and fetch transactions with it. That needs a
 * licence or a licensed aggregator and agreements with the banks, none of
 * which exist for this prototype. So the only provider is the simulated one,
 * and everything downstream of this interface is real.
 */
export interface AccountProvider {
  id: string;
  /** True when the data is made up. Shown wherever a linked account appears. */
  simulated: boolean;
  /** The banks a customer can link through this provider. */
  banks: readonly string[];
  transactions(account: LinkedAccount, customerSeed: string, asOf: string): Promise<Transaction[]>;
}

export const simulatedAccounts: AccountProvider = {
  id: "simulated",
  simulated: true,
  banks: DEMO_BANKS,
  async transactions(account, customerSeed, asOf) {
    return generateLinked(account, customerSeed, asOf);
  },
};

/** The provider in use. A licensed account-information provider would be returned here instead. */
export const accountProvider = (): AccountProvider => simulatedAccounts;
