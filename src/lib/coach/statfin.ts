import snapshot from "@/lib/coach/statfin-data.json";

/**
 * National context from Statistics Finland's household budget survey
 * (see scripts/fetch-statfin.ts). Figures are per consumption unit, which
 * adjusts for household size. Category mappings are approximate and are only
 * used where the two definitions are close.
 */
const DIVISION_BY_CATEGORY: Record<string, string> = {
  Groceries: "01",
  Health: "06",
  Transportation: "07",
  Entertainment: "09",
  Restaurants: "11",
};

const AGE_GROUPS: [maxAge: number, group: string][] = [
  [24, "17-24"],
  [34, "25-34"],
  [44, "35-44"],
  [54, "45-54"],
  [64, "55-64"],
  [74, "65-74"],
  [84, "75-84"],
  [Infinity, "85-"],
];

export interface NationalAverage {
  cents: number;
  ageGroup: string;
  year: number;
}

const data = snapshot.centsByAgeGroup as Record<string, Record<string, number>>;

export function nationalAverage(category: string, age: number | null): NationalAverage | null {
  const division = DIVISION_BY_CATEGORY[category];
  if (!division) return null;
  const group = age === null ? "SSS" : (AGE_GROUPS.find(([max]) => age <= max)?.[1] ?? "SSS");
  const cents = data[group]?.[division];
  if (cents === undefined) return null;
  return {
    cents,
    ageGroup: group === "SSS" ? "17+" : group.replace(/-$/, "+"),
    year: snapshot.year,
  };
}
