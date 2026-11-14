import type { MortgageStory } from "@/lib/data/mortgage";

/** One source transaction, as held in memory after decryption. Money is integer cents. */
export interface Transaction {
  /** 1-based data row in the source file: the stable tie-breaker for equal timestamps. */
  row: number;
  /** Local calendar date, YYYY-MM-DD. */
  date: string;
  /** Local time of day, HH:mm:ss. The source gives no timezone. */
  time: string;
  amountCents: number;
  balanceCents: number;
  category: string;
  type: string;
  merchantId: string | null;
  mcc: string | null;
  /** Set for a transaction from a linked account at another bank; absent for the bank's own account. */
  account?: string;
  /** The customer's own correction of which basket this belongs to. The rules' answer is kept alongside. */
  override?: {
    basket: "regular" | "irregular" | "everyday";
    necessity: "essential" | "discretionary";
  };
}

/** One account in the customer's combined view. */
export interface AccountSummary {
  /** "main" for the bank's own account. */
  id: string;
  /** Present for linked accounts. */
  bank?: string;
  kind: "main" | "everyday" | "savings" | "credit";
  nickname?: string;
  balanceCents: number;
  /** Whether its transactions take part in the calculations. */
  included: boolean;
  /** True for linked accounts: fabricated data, shown as a simulation. */
  simulated: boolean;
}

export interface CustomerProfile {
  customerId: string;
  accountId: string;
  age: number | null;
  postalCode: string | null;
}

export interface CustomerRecord {
  profile: CustomerProfile;
  /** All included accounts merged in time order, with the customer's corrections applied. */
  transactions: Transaction[];
  /** Every account the customer has, included or not. Absent means only the bank's own account. */
  accounts?: AccountSummary[];
  /** Money the customer has marked as set aside for goals. It is not available to spend. */
  earmarkedCents?: number;
  /** The customer's own mortgage application, if the dataset has one for them. */
  mortgage?: MortgageStory;
}
