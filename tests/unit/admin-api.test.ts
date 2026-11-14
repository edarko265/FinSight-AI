import { describe, expect, it } from "vitest";

import { requireResult } from "@/components/admin/admin-api";

describe("requireResult", () => {
  it("returns a value that arrived", () => {
    expect(requireResult({ staff: [] })).toEqual({ staff: [] });
  });

  it("keeps falsy values that are not a failure", () => {
    expect(requireResult(0)).toBe(0);
    expect(requireResult("")).toBe("");
  });

  it("throws on null so a failed call is a failed action", () => {
    expect(() => requireResult(null)).toThrow("request_failed");
  });
});
