import { describe, expect, it } from "vitest";

import { MoneyParseError, formatEur, parseDecimalToCents } from "@/lib/money";

describe("parseDecimalToCents", () => {
  it("parses whole and fractional amounts to integer cents", () => {
    expect(parseDecimalToCents("12")).toBe(1200);
    expect(parseDecimalToCents("12.5")).toBe(1250);
    expect(parseDecimalToCents("1043.07")).toBe(104307);
    expect(parseDecimalToCents("0.01")).toBe(1);
  });

  it("keeps the sign of negative amounts", () => {
    expect(parseDecimalToCents("-4.20")).toBe(-420);
    expect(parseDecimalToCents("-0.00")).toBe(0);
  });

  it("does not lose cents the way binary floats do", () => {
    // 0.07 * 100 === 7.000000000000001 and 1.15 * 100 === 114.99999999999999
    expect(parseDecimalToCents("0.07")).toBe(7);
    expect(parseDecimalToCents("1.15")).toBe(115);
  });

  it("accepts trailing zeros beyond two decimals", () => {
    expect(parseDecimalToCents("3.1000")).toBe(310);
  });

  it("rejects more than two non-zero decimal places", () => {
    expect(() => parseDecimalToCents("3.141")).toThrow(MoneyParseError);
  });

  it("rejects anything that is not a plain decimal", () => {
    for (const input of ["", "abc", "1,50", "1e3", "12.", ".5", "€5"]) {
      expect(() => parseDecimalToCents(input)).toThrow(MoneyParseError);
    }
  });

  it("rejects amounts outside the safe integer range", () => {
    expect(() => parseDecimalToCents("99999999999999999")).toThrow(MoneyParseError);
  });
});

describe("formatEur", () => {
  it("formats cents as euros", () => {
    expect(formatEur(104307).replace(/\s/g, " ")).toBe("1 043,07 €");
  });

  it("rejects non-integer cents", () => {
    expect(() => formatEur(1.5)).toThrow(RangeError);
  });
});
