/**
 * The mortgage files in the bank's dataset: an event history for 200
 * applications and each one's outcome. They are used for teaching only: what
 * an application looks like, how long it takes, what it costs along the way,
 * and why applications are turned down. Nothing here predicts or decides
 * whether anyone would get a loan.
 */
export const MORTGAGE_EVENTS = [
  "application_created",
  "customer_contact",
  "property_added",
  "property_price_updated",
  "loan_calculation",
  "income_information_received",
  "document_received",
  "collateral_added",
  "collateral_valuation",
  "additional_collateral_requested",
  "expense_recorded",
  "loan_decision",
] as const;
export type MortgageEventType = (typeof MORTGAGE_EVENTS)[number];

export interface MortgageEvent {
  date: string;
  type: MortgageEventType;
  propertyType?: string;
  priceCents?: number;
  loanCents?: number;
  equityCents?: number;
  collateralValueCents?: number;
  collateralStatus?: string;
  decision?: string;
  rejectionReason?: string;
  expenseType?: string;
  expenseCents?: number;
}

/** One customer's own application, sealed with their key. */
export interface MortgageStory {
  events: MortgageEvent[];
  outcome: {
    decision: "approved" | "rejected";
    rejectionReason: string | null;
    priceCents: number;
    loanCents: number;
    equityCents: number;
    collateralCents: number;
    requiredMonthlyIncomeCents: number;
    /** Loan as a percentage of the property price. */
    loanToValuePercent: number;
  };
}

/** Anonymous figures across all applications in the dataset. No row describes a person. */
export interface MortgageStats {
  applications: number;
  approved: number;
  rejected: number;
  reasons: Record<string, number>;
  days: { median: number; min: number; max: number };
  medianEvents: number;
  medianProperties: number;
  medianLoanToValuePercent: number;
  medianEquityPercent: number;
  /** Typical day, counted from the start, on which each step first happens. */
  stageDay: Partial<Record<MortgageEventType, number>>;
  /** Share of applications in which each step happens at all, in percent. */
  stageShare: Partial<Record<MortgageEventType, number>>;
  expenses: Record<string, { applications: number; medianCents: number }>;
}
