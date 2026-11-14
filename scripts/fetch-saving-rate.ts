import { writeFile } from "node:fs/promises";
import path from "node:path";

/**
 * Fetches the Finnish household saving rate from Statistics Finland's open
 * PxWeb API (table 15ac, annual sector accounts) and saves a small snapshot
 * for the voucher ladder. Run by hand; the snapshot is committed so the app
 * never calls the API while answering.
 *
 * The annual table publishes no rate, only amounts, so the rate is derived as
 * net saving (B8N) / net disposable income (B6N) for households (S14). That is
 * the same definition as the published quarterly "saving rate" in table 15a8:
 * it reproduces the 2025Q1-Q4 original series to one decimal.
 */
const TABLE = "https://pxdata.stat.fi/PXWeb/api/v1/en/StatFin/ntp/15ac.px";
const YEARS = 5;

type Meta = { variables: { code: string; values: string[] }[] };
type JsonStat = {
  id: string[];
  size: number[];
  value: (number | null)[];
  updated?: string;
  dimension: Record<string, { category: { index: Record<string, number> } }>;
};

async function main(): Promise<void> {
  const meta = (await (await fetch(TABLE)).json()) as Meta;
  const allYears = meta.variables.find((variable) => variable.code === "timeperiod_y")?.values;
  if (!allYears) throw new Error("Year variable not found");
  const years = allYears.slice(-YEARS);

  const response = await fetch(TABLE, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      query: [
        { code: "sektoriluokitus_7_20230101", selection: { filter: "item", values: ["S14"] } },
        { code: "taloustoimi_1_20180101", selection: { filter: "item", values: ["B6N", "B8N"] } },
        { code: "timeperiod_y", selection: { filter: "item", values: years } },
        { code: "contentscode", selection: { filter: "item", values: ["ntp-cp"] } },
      ],
      response: { format: "json-stat2" },
    }),
  });
  if (!response.ok) throw new Error(`Statistics Finland returned ${response.status}`);
  const data = (await response.json()) as JsonStat;

  const yearAt = data.dimension.timeperiod_y?.category.index ?? {};
  const value = (year: string, tx: string): number => {
    // Sector and contents have one value each, so only year and transaction vary.
    const at = data.id.reduce((offset, dimension, index) => {
      const key =
        dimension === "timeperiod_y" ? year : dimension === "taloustoimi_1_20180101" ? tx : null;
      const position = key === null ? 0 : (data.dimension[dimension]?.category.index[key] ?? 0);
      return offset * (data.size[index] ?? 1) + position;
    }, 0);
    const found = data.value[at];
    if (typeof found !== "number") throw new Error(`Missing ${tx} for ${year}`);
    return found;
  };

  const rates = Object.keys(yearAt)
    .sort()
    .map((year) => {
      const saving = value(year, "B8N");
      const income = value(year, "B6N");
      return { year: Number(year), ratePercent: Math.round((saving / income) * 1000) / 10 };
    });
  const latest = rates[rates.length - 1];
  if (!latest) throw new Error("No rates");

  const snapshot = {
    source: {
      name: "Statistics Finland, Annual national accounts, household net saving rate (net saving / net disposable income)",
      table: "15ac",
      url: "https://pxdata.stat.fi/PXWeb/pxweb/en/StatFin/StatFin__ntp/15ac.px",
      licence: "CC BY 4.0",
      updated: (data.updated ?? "").slice(0, 10),
    },
    year: latest.year,
    ratePercent: latest.ratePercent,
    history: rates,
  };
  const file = path.join("src", "lib", "analytics", "saving-rate-data.json");
  await writeFile(file, `${JSON.stringify(snapshot, null, 2)}\n`);
  console.log(`Saved ${file}`);
  console.table(rates);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
