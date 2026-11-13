import type { ChartCard, DashboardWidget } from "@/lib/contracts/chart";

/**
 * Hand-authored UI fixtures. They stand in for server calculations until the analytics layer
 * exists, and are deliberately not derived from the bank dataset.
 */

export const DEMO_ACCOUNT = {
  balanceCents: 289_000,
  asOf: "31 Oct 2026",
} as const;

export const SPENDING_BY_CATEGORY: ChartCard = {
  title: "Where my money went",
  summary: "Housing and groceries made up just over half of your spending in October.",
  basis: "Example data · October, consumption only",
  chart: {
    kind: "donut",
    points: [
      { label: "Housing", valueCents: 108_000 },
      { label: "Groceries", valueCents: 41_200 },
      { label: "Restaurants", valueCents: 23_800 },
      { label: "Transport", valueCents: 19_500 },
      { label: "Other", valueCents: 31_400 },
    ],
  },
};

export const MONTHLY_SPENDING: ChartCard = {
  title: "Spending per month",
  summary: "Spending was highest in August and has eased since.",
  basis: "Example data · last six months",
  chart: {
    kind: "bar",
    points: [
      { label: "May", valueCents: 198_000 },
      { label: "Jun", valueCents: 204_500 },
      { label: "Jul", valueCents: 221_000 },
      { label: "Aug", valueCents: 236_400 },
      { label: "Sep", valueCents: 214_900 },
      { label: "Oct", valueCents: 223_900 },
    ],
  },
};

export const BALANCE_TREND: ChartCard = {
  title: "Account balance",
  summary: "Your balance dipped at the end of August and has recovered since.",
  basis: "Example data · recorded balance, end of each month",
  chart: {
    kind: "line",
    points: [
      { label: "May", valueCents: 312_000 },
      { label: "Jun", valueCents: 298_500 },
      { label: "Jul", valueCents: 287_000 },
      { label: "Aug", valueCents: 241_000 },
      { label: "Sep", valueCents: 266_500 },
      { label: "Oct", valueCents: 289_000 },
    ],
  },
};

export const RESTAURANT_TREND: ChartCard = {
  title: "Restaurant spending",
  summary: "Restaurant spending was higher this month than in any of the previous five.",
  basis: "Example data · last six months",
  chart: {
    kind: "bar",
    points: [
      { label: "May", valueCents: 17_200 },
      { label: "Jun", valueCents: 18_900 },
      { label: "Jul", valueCents: 16_400 },
      { label: "Aug", valueCents: 21_100 },
      { label: "Sep", valueCents: 19_300 },
      { label: "Oct", valueCents: 23_800 },
    ],
  },
};

export const INITIAL_WIDGETS: DashboardWidget[] = [
  { id: "widget-spending-by-category", ...SPENDING_BY_CATEGORY },
  { id: "widget-balance", ...BALANCE_TREND },
  { id: "widget-monthly-spending", ...MONTHLY_SPENDING },
];

export const PROMPT_SUGGESTIONS: readonly string[] = [
  "Where does my money go?",
  "Show my balance over time",
  "How has my restaurant spending changed?",
];
