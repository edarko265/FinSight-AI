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
}

export interface CustomerProfile {
  customerId: string;
  accountId: string;
  age: number | null;
  postalCode: string | null;
}

export interface CustomerRecord {
  profile: CustomerProfile;
  transactions: Transaction[];
}
