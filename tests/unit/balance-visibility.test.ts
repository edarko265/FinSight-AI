import { describe, expect, it } from "vitest";

import { showHeaderBalance } from "@/components/dashboard/balance-visibility";

describe("showHeaderBalance", () => {
  it("shows the balance only after the dashboard balance has left the viewport", () => {
    expect(showHeaderBalance(true)).toBe(false);
    expect(showHeaderBalance(false)).toBe(true);
  });
});
