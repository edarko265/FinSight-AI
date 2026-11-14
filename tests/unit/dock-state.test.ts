import { describe, expect, it } from "vitest";

import {
  dockReducer,
  initialDockState,
  type DockAction,
  type DockState,
} from "@/components/chat/dock-state";

const run = (actions: DockAction[], from: DockState = initialDockState): DockState =>
  actions.reduce(dockReducer, from);

describe("dockReducer", () => {
  it("opens as half, mounts, and keeps full when already full", () => {
    const opened = run([{ type: "open" }]);
    expect(opened).toMatchObject({ mode: "half", mounted: true });
    expect(run([{ type: "setMode", mode: "full" }, { type: "open" }], opened).mode).toBe("full");
  });

  it("closes but stays mounted", () => {
    expect(run([{ type: "open" }, { type: "close" }])).toMatchObject({
      mode: "closed",
      mounted: true,
    });
  });

  it("sets the mode", () => {
    expect(run([{ type: "open" }, { type: "setMode", mode: "full" }]).mode).toBe("full");
  });

  it("tracks pending", () => {
    const s = run([{ type: "open" }, { type: "status", pending: true, count: 2 }]);
    expect(s.pending).toBe(true);
    expect(s.unread).toBe(false);
  });

  it("flags unread only when a message arrives while closed", () => {
    const base = run([
      { type: "open" },
      { type: "status", pending: true, count: 2 },
      { type: "close" },
    ]);
    expect(run([{ type: "status", pending: true, count: 2 }], base).unread).toBe(false);
    const arrived = run([{ type: "status", pending: false, count: 3 }], base);
    expect(arrived.unread).toBe(true);
    expect(arrived.pending).toBe(false);
  });

  it("clears unread on open", () => {
    const s = run([
      { type: "open" },
      { type: "status", pending: false, count: 1 },
      { type: "close" },
      { type: "status", pending: false, count: 2 },
      { type: "open" },
    ]);
    expect(s.unread).toBe(false);
  });

  it("starts a new conversation", () => {
    const s = run([
      { type: "open" },
      { type: "status", pending: true, count: 4 },
      { type: "restart" },
    ]);
    expect(s).toMatchObject({ conversation: 1, count: 0, pending: false, unread: false });
  });
});
