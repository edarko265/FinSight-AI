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

/**
 * What the snapshot may contain is fixed here. The service's answer is used
 * only for its numbers: every name, code and label that reaches the file comes
 * from these lists, so nothing the service sends can end up in it as text.
 */
const DIVISIONS: Record<string, string> = {
  "0": "0 Total",
  "01": "01 Food and non-alcoholic beverages",
  "02": "02 Alcoholic beverage and tobacco",
  "03": "03 Clothing and footwear",
  "04": "04 Housing, water, electricity, gas and other fuels",
  "05": "05 Furnishings, household equipment and routine household maintenance",
  "06": "06 Health",
  "07": "07 Transport",
  "08": "08 Information and communication",
  "09": "09 Recreation, sport and culture",
  "10": "10 Education services",
  "11": "11 Restaurants and accommodation services",
  "12": "12 Insurance and financial services",
  "13": "13 Personal care, social protection and miscellaneous goods and services",
  "77": "77 Total consumption abroad",
  "99": "99 Items outside consumption expenditure",
};
const AGE_GROUPS = ["SSS", "17-24", "25-34", "35-44", "45-54", "55-64", "65-74", "75-84", "85-"];
/** No monthly figure per person is anywhere near this; anything above it is not a real value. */
const MAX_EUROS = 100_000;

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
  // Only the divisions and age groups listed above, and only those the table still has.
  const divisions = Object.keys(DIVISIONS).filter((code) => coicop.values.includes(code));
  const offered = meta.variables.find((variable) => variable.code === AGE)?.values ?? [];
  const ages = AGE_GROUPS.filter((age) => offered.includes(age));
  if (divisions.length === 0 || ages.length === 0) {
    throw new Error("The table no longer has the expected divisions or age groups");
  }

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
  for (const age of ages) {
    const values: Record<string, number> = {};
    for (const code of divisions) {
      const euros = data.value[position({ [AGE]: age, [coicop.code]: code })];
      if (typeof euros !== "number") continue;
      if (!Number.isFinite(euros) || euros < 0 || euros > MAX_EUROS) {
        throw new Error(`Unexpected value for ${age} / ${code}`);
      }
      values[code] = Math.round(euros * 100);
    }
    byAge[age] = values;
  }

  // The table's own date, re-made from a timestamp rather than copied as text.
  const updatedAt = Date.parse(data.updated ?? "");

  const snapshot = {
    source: "Statistics Finland, Households' consumption, table 14q4",
    url: "https://pxdata.stat.fi/PXWeb/pxweb/en/StatFin/StatFin__ktutk/14q4.px",
    licence: "CC BY 4.0",
    measure:
      "Consumption expenditure per consumption unit, current prices, EUR per month (stored as cents)",
    year: Number(YEAR),
    retrieved: new Date().toISOString().slice(0, 10),
    tableUpdated: Number.isNaN(updatedAt)
      ? null
      : new Date(updatedAt).toISOString().replace(".000Z", "Z"),
    divisions: Object.fromEntries(divisions.map((code) => [code, DIVISIONS[code]])),
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
