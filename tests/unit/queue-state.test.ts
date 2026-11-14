import { describe, expect, it } from "vitest";

import { applyQueueAction, type QueueEntry } from "@/components/admin/queue-state";

const queue: QueueEntry[] = [
  { id: "a", status: "open", deleted: false },
  { id: "b", status: "closed", deleted: true },
];

describe("applyQueueAction", () => {
  it("bins and restores one entry", () => {
    expect(applyQueueAction(queue, "a", "trash")[0]?.deleted).toBe(true);
    expect(applyQueueAction(queue, "b", "restore")[1]?.deleted).toBe(false);
  });

  it("removes a purged entry", () => {
    expect(applyQueueAction(queue, "b", "purge").map((item) => item.id)).toEqual(["a"]);
  });

  it("closes and reopens, leaving other entries alone", () => {
    expect(applyQueueAction(queue, "a", "close")[0]?.status).toBe("closed");
    expect(applyQueueAction(queue, "b", "reopen")[1]?.status).toBe("open");
    expect(applyQueueAction(queue, "a", "close")[1]).toEqual(queue[1]);
  });
});
