import { describe, expect, it } from "vitest";

import { initialLoadState, loadReducer } from "@/components/shared/load-state";

describe("loadReducer", () => {
  it("starts loading with no data", () => {
    expect(initialLoadState<string>("en")).toEqual({
      key: "en",
      data: null,
      failed: false,
      loading: true,
    });
  });

  it("drops data and a failure when the key changes", () => {
    const loaded = loadReducer(initialLoadState<string>("en"), {
      type: "success",
      key: "en",
      data: "Hello",
    });
    const reloading = loadReducer(loaded, { type: "start", key: "fi" });
    expect(reloading).toEqual({ key: "fi", data: null, failed: false, loading: true });

    const failed = loadReducer(loaded, { type: "failure", key: "fi" });
    expect(failed.data).toBeNull();
    expect(failed.failed).toBe(true);
  });

  it("keeps data on retry and clears the failure while loading", () => {
    const failed = loadReducer(initialLoadState<string>("en"), { type: "failure", key: "en" });
    const retrying = loadReducer(failed, { type: "start", key: "en" });
    expect(retrying).toMatchObject({ failed: false, loading: true });

    const loaded = loadReducer(
      loadReducer(initialLoadState<string>("en"), { type: "success", key: "en", data: "x" }),
      { type: "start", key: "en" },
    );
    expect(loaded.data).toBe("x");
  });

  it("applies an update to the current data only", () => {
    const loaded = loadReducer(initialLoadState<number[]>("a"), {
      type: "success",
      key: "a",
      data: [1, 2],
    });
    const updated = loadReducer(loaded, {
      type: "update",
      key: "a",
      update: (current) => (current ? current.filter((n) => n !== 1) : null),
    });
    expect(updated.data).toEqual([2]);
  });
});
