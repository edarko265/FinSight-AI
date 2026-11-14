import { writeFile } from "node:fs/promises";
import path from "node:path";

/**
 * Fetches household consumption by age group from Statistics Finland's open
 * PxWeb API (table 14q4, household budget survey) and saves a small snapshot
 * for the national benchmark. Run by hand; the snapshot is committed so the
 * app never calls the API while answering.
 *
 * Measure: consumption expenditure per consumption unit, current prices, EUR
 * per month. "Per consumption unit" adjusts for household size, which makes it
 * the closest published figure to one adult's spending.
 */
const TABLE = "https://pxdata.stat.fi/PXWeb/api/v1/en/StatFin/ktutk/14q4.px";
const MEASURE = "kulukk_kt_hk_2_1";
const YEAR = "2022";
const AGE = "ikaryhma_10_20180101";

type Meta = { variables: { code: string; values: string[]; valueTexts: string[] }[] };
type JsonStat = {
  id: string[];
  size: number[];
  value: (number | null)[];
  updated?: string;
  dimension: Record<string, { category: { index: Record<string, number> } }>;
};

async function main(): Promise<void> {
  const meta = (await (await fetch(TABLE)).json()) as Meta;
  const coicop = meta.variables.find((variable) => variable.code.startsWith("coicop"));
  if (!coicop) throw new Error("COICOP variable not found");
  const divisions = coicop.values.filter((code) => code.length <= 2);
  const labels = Object.fromEntries(
    divisions.map((code) => [code, coicop.valueTexts[coicop.values.indexOf(code)] ?? code]),
  );

  const ages = meta.variables.find((variable) => variable.code === AGE)?.values ?? [];

  const query = {
    query: [
      { code: "timeperiod_y", selection: { filter: "item", values: [YEAR] } },
      { code: coicop.code, selection: { filter: "item", values: divisions } },
      { code: AGE, selection: { filter: "item", values: ages } },
      { code: "contentscode", selection: { filter: "item", values: [MEASURE] } },
    ],
    response: { format: "json-stat2" },
  };
  const response = await fetch(TABLE, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(query),
  });
  if (!response.ok) throw new Error(`Statistics Finland returned ${response.status}`);
  const data = (await response.json()) as JsonStat;

  const position = (selection: Record<string, string>): number =>
    data.id.reduce((offset, dimension, index) => {
      const key = selection[dimension];
      const at = key === undefined ? 0 : (data.dimension[dimension]?.category.index[key] ?? 0);
      return offset * (data.size[index] ?? 1) + at;
    }, 0);

  const byAge: Record<string, Record<string, number>> = {};
  for (const age of Object.keys(data.dimension[AGE]?.category.index ?? {})) {
    byAge[age] = {};
    for (const code of divisions) {
      const euros = data.value[position({ [AGE]: age, [coicop.code]: code })];
      if (typeof euros === "number") byAge[age][code] = Math.round(euros * 100);
    }
  }

  const snapshot = {
    source: "Statistics Finland, Households' consumption, table 14q4",
    url: "https://pxdata.stat.fi/PXWeb/pxweb/en/StatFin/StatFin__ktutk/14q4.px",
    licence: "CC BY 4.0",
    measure:
      "Consumption expenditure per consumption unit, current prices, EUR per month (stored as cents)",
    year: Number(YEAR),
    retrieved: new Date().toISOString().slice(0, 10),
    tableUpdated: data.updated ?? null,
    divisions: labels,
    centsByAgeGroup: byAge,
  };
  const file = path.join("src", "lib", "coach", "statfin-data.json");
  await writeFile(file, `${JSON.stringify(snapshot, null, 2)}\n`);
  console.log(`Saved ${file}`);
  console.table(
    Object.fromEntries(
      Object.entries(byAge).map(([age, values]) => [
        age,
        Object.fromEntries(
          Object.entries(values).map(([code, cents]) => [code, Math.round(cents / 100)]),
        ),
      ]),
    ),
  );
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
