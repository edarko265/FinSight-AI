import { describe, expect, it } from "vitest";

import { createSessionGuard } from "@/components/voice/session-guard";

describe("session guard", () => {
  it("ends a session once", () => {
    const guard = createSessionGuard();
    guard.started();
    expect(guard.end()).toBe(true);
    expect(guard.end()).toBe(false);
  });

  it("still ends a session that started after the StrictMode cleanup", () => {
    const guard = createSessionGuard();
    expect(guard.end()).toBe(true); // first cleanup, before the session exists
    guard.started(); // the first start resolves; the remount does not restart
    expect(guard.end()).toBe(true); // End, Escape or a tab tap
    expect(guard.end()).toBe(false); // the unmount afterwards
  });
});
