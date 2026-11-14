import { describe, expect, it } from "vitest";

import {
  averageCents,
  barPercent,
  barVariant,
  isTimeSeries,
  sharePercents,
  donutShares,
  formatPercent,
  sortRanked,
  visibleLabelIndexes,
} from "@/components/charts/chart-data";
import { formatMonth } from "@/lib/i18n/config";

const p = (label: string, valueCents: number): { label: string; valueCents: number } => ({
  label,
  valueCents,
});

describe("sharePercents", () => {
  it("always adds up to 100", () => {
    expect(sharePercents([1, 1, 1])).toEqual([34, 33, 33]);
    expect(sharePercents([24367, 12533, 3820]).reduce((a, b) => a + b, 0)).toBe(100);
    expect(sharePercents([24367, 12533, 3820])).toEqual([60, 31, 9]);
  });
  it("handles zero and negative totals", () => {
    expect(sharePercents([0, 0])).toEqual([0, 0]);
    expect(sharePercents([-5, 100])).toEqual([0, 100]);
  });
});

describe("sortRanked", () => {
  it("sorts descending, stable, without mutating", () => {
    const input = [p("a", 5), p("b", 9), p("c", 5)];
    expect(sortRanked(input).map((x) => x.label)).toEqual(["b", "a", "c"]);
    expect(input[0]?.label).toBe("a");
  });
});

describe("time series detection", () => {
  it("recognises month labels in every language", () => {
    expect(
      isTimeSeries([p(formatMonth("2026-09", "en"), 1), p(formatMonth("2026-10", "en"), 2)]),
    ).toBe(true);
    expect(
      isTimeSeries([p(formatMonth("2026-01", "fi"), 1), p(formatMonth("2026-02", "fi"), 2)]),
    ).toBe(true);
    expect(isTimeSeries([p("Restaurants", 1), p("Lifestyle", 2)])).toBe(false);
    expect(isTimeSeries([p(formatMonth("2026-10", "en"), 1)])).toBe(false);
  });
  it("does not mistake a lone or mixed month-like label for a series", () => {
    expect(isTimeSeries([p("May", 1)])).toBe(false);
    expect(isTimeSeries([p("May", 1), p("Restaurants", 2)])).toBe(false);
    expect(isTimeSeries([p(formatMonth("2026-05", "sv"), 1)])).toBe(false);
    expect(
      isTimeSeries([p(formatMonth("2026-05", "sv"), 1), p(formatMonth("2026-06", "sv"), 2)]),
    ).toBe(true);
  });
  it("picks columns for months and rows for categories", () => {
    expect(
      barVariant([p(formatMonth("2026-09", "en"), 1), p(formatMonth("2026-10", "en"), 2)]),
    ).toBe("columns");
    expect(barVariant([p("Cafés", 1), p("Lifestyle", 2)])).toBe("rows");
  });
});

describe("averageCents and barPercent", () => {
  it("rounds the average once, in whole cents", () => {
    expect(averageCents([p("a", 100), p("b", 101)])).toBe(101);
    expect(averageCents([])).toBe(0);
    expect(averageCents([p("a", 24367), p("b", 12533), p("c", 3820)])).toBe(13573);
  });
  it("scales bars against the largest and keeps tiny ones visible", () => {
    expect(barPercent(50, 100)).toBe(50);
    expect(barPercent(0, 100)).toBe(1);
    expect(barPercent(-10, 100)).toBe(1);
    expect(barPercent(5, 0)).toBe(1);
  });
});

describe("formatPercent, donutShares, visibleLabelIndexes", () => {
  it("writes percentages for the locale", () => {
    expect(formatPercent(60, "en")).toBe("60%");
    expect(formatPercent(60, "fi").replace(/\s/g, " ")).toBe("60 %");
  });
  it("leaves refunds out of the donut so shares sum to 1", () => {
    const { positiveCents, fractions } = donutShares([p("a", 300), p("b", -50), p("c", 100)]);
    expect(positiveCents).toBe(400);
    expect(fractions).toEqual([0.75, 0, 0.25]);
  });
  it("labels every month up to 6, then every other counting back from the latest", () => {
    expect(visibleLabelIndexes(6)).toEqual([0, 1, 2, 3, 4, 5]);
    expect(visibleLabelIndexes(12)).toEqual([1, 3, 5, 7, 9, 11]);
  });
});
