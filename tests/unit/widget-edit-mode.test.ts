import { describe, expect, it } from "vitest";

import { nextWidgetMode } from "@/components/dashboard/widget-edit-mode";

describe("nextWidgetMode", () => {
  it("enters editing after a long press", () => {
    expect(nextWidgetMode("view", "long-press")).toBe("editing");
  });

  it("leaves editing when the open widget surface is tapped", () => {
    expect(nextWidgetMode("editing", "tap-surface")).toBe("view");
  });
});
