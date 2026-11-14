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
const TIMEOUT_MS = 30_000;
const YEAR_DIM = "timeperiod_y";
const TX_DIM = "taloustoimi_1_20180101";
const SECTOR_DIM = "sektoriluokitus_7_20230101";
const CONTENTS_DIM = "contentscode";

type Meta = { variables: { code: string; values: string[]; valueTexts: string[] }[] };
type JsonStat = {
  id: string[];
  size: number[];
  value: (number | null)[];
  updated?: string;
  dimension: Record<string, { category: { index: Record<string, number> } }>;
};

async function main(): Promise<void> {
  const metaResponse = await fetch(TABLE, { signal: AbortSignal.timeout(TIMEOUT_MS) });
  if (!metaResponse.ok)
    throw new Error(`Statistics Finland metadata returned ${metaResponse.status}`);
  const meta = (await metaResponse.json()) as Meta;
  const yearVariable = meta.variables.find((variable) => variable.code === YEAR_DIM);
  if (!yearVariable) throw new Error("Year variable not found");
  const years = yearVariable.values.slice(-YEARS);
  // Provisional years carry a trailing "*" in their label, e.g. "2025*".
  const provisional = new Set(
    yearVariable.values.filter((_, index) => yearVariable.valueTexts[index]?.endsWith("*")),
  );

  const response = await fetch(TABLE, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    signal: AbortSignal.timeout(TIMEOUT_MS),
    body: JSON.stringify({
      query: [
        { code: SECTOR_DIM, selection: { filter: "item", values: ["S14"] } },
        { code: TX_DIM, selection: { filter: "item", values: ["B6N", "B8N"] } },
        { code: YEAR_DIM, selection: { filter: "item", values: years } },
        { code: CONTENTS_DIM, selection: { filter: "item", values: ["ntp-cp"] } },
      ],
      response: { format: "json-stat2" },
    }),
  });
  if (!response.ok) throw new Error(`Statistics Finland returned ${response.status}`);
  const data = (await response.json()) as JsonStat;
  if (!data.updated) throw new Error("Response has no updated date");

  for (const dimension of [YEAR_DIM, TX_DIM, SECTOR_DIM, CONTENTS_DIM]) {
    if (!data.dimension[dimension]) throw new Error(`Dimension ${dimension} missing`);
  }
  data.id.forEach((dimension, index) => {
    const varies = dimension === YEAR_DIM || dimension === TX_DIM;
    if (!varies && data.size[index] !== 1)
      throw new Error(`Dimension ${dimension} is not a single value`);
  });

  const value = (year: string, tx: string): number => {
    const at = data.id.reduce((offset, dimension, index) => {
      const key = dimension === YEAR_DIM ? year : dimension === TX_DIM ? tx : null;
      const position = key === null ? 0 : data.dimension[dimension]?.category.index[key];
      if (position === undefined) throw new Error(`Missing key ${key} in ${dimension}`);
      return offset * (data.size[index] ?? 1) + position;
    }, 0);
    const found = data.value[at];
    if (typeof found !== "number") throw new Error(`Missing ${tx} for ${year}`);
    return found;
  };

  const rates = years.map((year) => {
    const saving = value(year, "B8N");
    const income = value(year, "B6N");
    if (income <= 0) throw new Error(`Net disposable income for ${year} is ${income}`);
    const ratePercent = Math.round((saving / income) * 1000) / 10;
    // A figure outside this range means the table changed shape, not that Finns changed habits.
    if (!Number.isFinite(ratePercent) || ratePercent < -20 || ratePercent > 40) {
      throw new Error(`Implausible saving rate ${ratePercent} for ${year}`);
    }
    return { year: Number(year), ratePercent, provisional: provisional.has(year) };
  });
  const latest = rates[rates.length - 1];
  if (!latest) throw new Error("No rates");

  const snapshot = {
    source: {
      name: "Statistics Finland, Annual national accounts, household net saving rate (net saving / net disposable income)",
      table: "15ac",
      url: "https://pxdata.stat.fi/PXWeb/pxweb/en/StatFin/StatFin__ntp/15ac.px",
      licence: "CC BY 4.0",
      updated: data.updated.slice(0, 10),
    },
    year: latest.year,
    ratePercent: latest.ratePercent,
    provisional: latest.provisional,
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
