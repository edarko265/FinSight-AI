import type { Transaction } from "@/lib/data/types";

/**
 * Versioned, inspectable classification rules. These are a product proposal,
 * not a bank definition: every result carries the reason it was given, and
 * anything the rules cannot place is left visibly unclassified.
 */
export const RULE_VERSION = "2026-11-14.1";

export type Flow =
  | "consumption"
  | "salary"
  | "other_income"
  | "investment_out"
  | "investment_in"
  | "salary_sweep"
  | "unknown";

export type Basket = "regular" | "irregular" | "everyday" | "unclassified";
export type Necessity = "essential" | "discretionary" | "unknown";

export interface Classification {
  basket: Basket;
  necessity: Necessity;
  reason: string;
}

const FLOW_BY_TYPE: Record<string, Flow> = {
  purchase: "consumption",
  utilities_payment: "consumption",
  housing_payment: "consumption",
  salary: "salary",
  other_income: "other_income",
  investment_deposit: "investment_out",
  investment_withdrawal: "investment_in",
  salary_sweep: "salary_sweep",
};

export function flowOf(tx: Transaction): Flow {
  return FLOW_BY_TYPE[tx.type] ?? "unknown";
}

export function isConsumption(tx: Transaction): boolean {
  return flowOf(tx) === "consumption";
}

/** Merchant category codes present in the dataset, in plain words. */
export const MCC_LABELS: Record<string, string> = {
  "4111": "Public transport",
  "4121": "Taxis",
  "4511": "Flights",
  "4722": "Travel agencies",
  "5200": "Home supplies",
  "5251": "Hardware",
  "5411": "Supermarkets",
  "5422": "Meat and fish shops",
  "5451": "Dairy shops",
  "5499": "Convenience food",
  "5541": "Fuel stations",
  "5542": "Self-service fuel",
  "5651": "Clothing",
  "5691": "Clothing",
  "5712": "Furniture",
  "5732": "Electronics",
  "5734": "Software",
  "5812": "Restaurants",
  "5813": "Bars",
  "5814": "Cafés and fast food",
  "5912": "Pharmacies",
  "5941": "Sporting goods",
  "5942": "Books",
  "5945": "Hobbies and toys",
  "5999": "Other retail",
  "7011": "Hotels",
  "7512": "Car rental",
  "7523": "Parking",
  "7832": "Cinema",
  "7922": "Theatre and tickets",
  "7991": "Attractions",
  "7996": "Amusement parks",
  "7999": "Recreation",
  "8011": "Doctors",
  "8021": "Dentists",
  "8099": "Health services",
};

type Rule = Classification & { mcc?: Record<string, Partial<Classification>> };

const RULES: Record<string, Rule> = {
  Housing: {
    basket: "regular",
    necessity: "essential",
    reason: "Housing costs come every month and have to be paid.",
  },
  Utilities: {
    basket: "regular",
    necessity: "essential",
    reason: "Utility bills recur and have to be paid.",
  },
  Health: {
    basket: "irregular",
    necessity: "essential",
    reason: "Health costs are necessary but do not arrive on a schedule.",
  },
  "Home & Tech": {
    basket: "irregular",
    necessity: "unknown",
    reason:
      "Household and tech purchases are occasional. Whether one was necessary, like a repair, only you know.",
    mcc: {
      "5200": {
        necessity: "essential",
        reason: "Home supplies and repairs are occasional but necessary.",
      },
      "5251": {
        necessity: "essential",
        reason: "Hardware and repairs are occasional but necessary.",
      },
    },
  },
  Groceries: {
    basket: "everyday",
    necessity: "essential",
    reason: "Food is everyday spending, and essential.",
  },
  Transportation: {
    basket: "everyday",
    necessity: "essential",
    reason: "Getting around is everyday spending, and mostly essential.",
    mcc: {
      "4121": {
        necessity: "discretionary",
        reason: "Taxis are everyday spending you can usually choose.",
      },
      "7523": {
        necessity: "unknown",
        reason: "Parking is everyday spending; how necessary depends on you.",
      },
    },
  },
  Restaurants: {
    basket: "everyday",
    necessity: "discretionary",
    reason: "Eating out is everyday spending you can choose.",
  },
  Entertainment: {
    basket: "everyday",
    necessity: "discretionary",
    reason: "Entertainment is everyday spending you can choose.",
  },
  Lifestyle: {
    basket: "everyday",
    necessity: "discretionary",
    reason: "Shopping and hobbies are everyday spending you can choose.",
  },
  Travel: {
    basket: "everyday",
    necessity: "discretionary",
    reason: "Travel is a choice, even when the amounts are large and occasional.",
  },
};

const UNCLASSIFIED: Classification = {
  basket: "unclassified",
  necessity: "unknown",
  reason: "No rule covers this kind of transaction yet.",
};

/** Places a consumption transaction in a basket. Non-consumption is never classified. */
export function classify(tx: Transaction): Classification {
  if (!isConsumption(tx)) return UNCLASSIFIED;
  // The customer knows their own purchases best: a correction they made wins over the rules.
  if (tx.override) return { ...tx.override, reason: OWN_CHOICE };
  return classifyByRules(tx);
}

export const OWN_CHOICE = "You set this yourself.";

/** What the rules say, ignoring any correction. Kept so a correction can be shown and undone. */
export function classifyByRules(tx: Transaction): Classification {
  if (!isConsumption(tx)) return UNCLASSIFIED;
  const rule = RULES[tx.category];
  if (!rule) return UNCLASSIFIED;
  const override = tx.mcc ? rule.mcc?.[tx.mcc] : undefined;
  return {
    basket: override?.basket ?? rule.basket,
    necessity: override?.necessity ?? rule.necessity,
    reason: override?.reason ?? rule.reason,
  };
}

export const CONSUMPTION_CATEGORIES = Object.keys(RULES);
