import { describe, expect, it } from "vitest";

import {
  averageCents,
  barPercent,
  barVariant,
  isTimeSeries,
  sharePercents,
  sortRanked,
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
