import { describe, expect, it } from "vitest";

import { dragStartDelay } from "@/components/dashboard/widget-drag";

describe("dragStartDelay", () => {
  it("starts mouse and pen drags immediately", () => {
    expect(dragStartDelay("mouse")).toBe(0);
    expect(dragStartDelay("pen")).toBe(0);
  });

  it("requires a short hold before a touch drag", () => {
    expect(dragStartDelay("touch")).toBeGreaterThanOrEqual(250);
  });
});
