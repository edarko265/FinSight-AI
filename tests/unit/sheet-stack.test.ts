import { describe, expect, it } from "vitest";

import { isTopmostSheet, popSheet, pushSheet } from "@/components/ui/sheet-stack";

describe("sheet stack", () => {
  it("treats the last opened sheet as topmost", () => {
    const stack = pushSheet(pushSheet([], "a"), "b");
    expect(isTopmostSheet(stack, "b")).toBe(true);
    expect(isTopmostSheet(stack, "a")).toBe(false);
  });

  it("hands Escape back to the sheet below when the top one closes", () => {
    const stack = popSheet(pushSheet(pushSheet([], "a"), "b"), "b");
    expect(stack).toEqual(["a"]);
    expect(isTopmostSheet(stack, "a")).toBe(true);
  });

  it("closing a lower sheet keeps the top one on top", () => {
    const stack = popSheet(pushSheet(pushSheet([], "a"), "b"), "a");
    expect(isTopmostSheet(stack, "b")).toBe(true);
  });

  it("moves a sheet that is pushed again to the top and ignores unknown ids", () => {
    const stack = pushSheet(pushSheet(pushSheet([], "a"), "b"), "a");
    expect(stack).toEqual(["b", "a"]);
    expect(popSheet(stack, "x")).toEqual(["b", "a"]);
    expect(isTopmostSheet([], "a")).toBe(false);
  });
});
