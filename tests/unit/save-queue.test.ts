import { describe, expect, it, vi } from "vitest";
import { createSaveQueue } from "@/components/dashboard/save-queue";
import { cardsFor } from "@/components/dashboard/useDashboardSave";

function deferred<T>(): {
  promise: Promise<T>;
  resolve: (v: T) => void;
  reject: (e: unknown) => void;
} {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

/** Lets promise callbacks run. */
const flush = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));

function setup() {
  const calls: Array<{ state: number[]; d: ReturnType<typeof deferred<string>> }> = [];
  const onChange = vi.fn();
  const onSaved = vi.fn();
  const onFailed = vi.fn();
  const queue = createSaveQueue<number[], string>({
    save: (state) => {
      const d = deferred<string>();
      calls.push({ state, d });
      return d.promise;
    },
    onChange,
    onSaved,
    onFailed,
  });
  queue.reset([]);
  return { queue, calls, onChange, onSaved, onFailed };
}

describe("createSaveQueue", () => {
  it("saves a lone change at once and resolves true", async () => {
    const { queue, calls, onSaved } = setup();
    const done = queue.change((s) => [...s, 1]);
    expect(calls).toHaveLength(1);
    expect(calls[0]?.state).toEqual([1]);
    expect(queue.busy()).toBe(true);
    calls[0]?.d.resolve("r1");
    expect(await done).toBe(true);
    await flush();
    expect(queue.busy()).toBe(false);
    expect(onSaved).toHaveBeenCalledWith("r1");
  });

  it("coalesces changes made during a save into one more save of the latest state", async () => {
    const { queue, calls, onSaved } = setup();
    const first = queue.change((s) => [...s, 1]);
    const second = queue.change((s) => [...s, 2]);
    const third = queue.change((s) => [...s, 3]);
    // Computed from the queue's state, not from where each caller started.
    expect(queue.desired()).toEqual([1, 2, 3]);
    expect(calls).toHaveLength(1);
    calls[0]?.d.resolve("old");
    expect(await first).toBe(true);
    await flush();
    expect(calls).toHaveLength(2);
    expect(calls[1]?.state).toEqual([1, 2, 3]);
    calls[1]?.d.resolve("new");
    expect(await second).toBe(true);
    expect(await third).toBe(true);
    await flush();
    // The older response never reaches the screen.
    expect(onSaved).toHaveBeenCalledTimes(1);
    expect(onSaved).toHaveBeenCalledWith("new");
  });

  it("reverts to the confirmed state when a save fails and fails every waiting change", async () => {
    const { queue, calls, onFailed, onChange } = setup();
    const first = queue.change((s) => [...s, 1]);
    calls[0]?.d.resolve("ok");
    await first;
    await flush();
    const second = queue.change((s) => [...s, 2]);
    const third = queue.change((s) => [...s, 3]);
    calls[1]?.d.reject(new Error("boom"));
    expect(await second).toBe(false);
    expect(await third).toBe(false);
    expect(queue.desired()).toEqual([1]);
    expect(onFailed).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenLastCalledWith([1], false);
    expect(queue.busy()).toBe(false);
    // The queue still works afterwards.
    void queue.change((s) => [...s, 9]);
    expect(calls[2]?.state).toEqual([1, 9]);
  });

  it("keeps the first batch confirmed when only the follow-up save fails", async () => {
    const { queue, calls } = setup();
    const first = queue.change((s) => [...s, 1]);
    const second = queue.change((s) => [...s, 2]);
    calls[0]?.d.resolve("a");
    expect(await first).toBe(true);
    await flush();
    calls[1]?.d.reject(new Error("boom"));
    expect(await second).toBe(false);
    expect(queue.desired()).toEqual([1]);
  });

  it("refuses to adopt server state while busy and idle() waits for the end", async () => {
    const { queue, calls } = setup();
    const done = queue.change((s) => [...s, 1]);
    expect(queue.reset([42])).toBe(false);
    expect(queue.desired()).toEqual([1]);
    const idle = vi.fn();
    void queue.idle().then(idle);
    await flush();
    expect(idle).not.toHaveBeenCalled();
    calls[0]?.d.resolve("r");
    await done;
    await flush();
    expect(idle).toHaveBeenCalled();
    expect(queue.reset([42])).toBe(true);
    expect(queue.desired()).toEqual([42]);
  });

  it("counts changes in version()", () => {
    const { queue } = setup();
    const before = queue.version();
    void queue.change((s) => s);
    expect(queue.version()).toBe(before + 1);
  });
});

describe("cardsFor", () => {
  const card = (id: string): never => ({ id, size: "small", collapsed: false }) as never;
  const payload = { activeId: "v", cards: [card("a"), card("b")] };
  const state = (widgets: Array<{ id: string; size?: "wide"; collapsed?: boolean }>) => ({
    activeId: "v",
    views: [{ id: "v", name: "", period: "last_month" as const, widgets: widgets as never }],
  });

  it("follows order, size, collapse and removal at once", () => {
    const cards = cardsFor(
      state([
        { id: "b", size: "wide" },
        { id: "a", collapsed: true },
      ]),
      payload,
    );
    expect(cards.map((c) => c.id)).toEqual(["b", "a"]);
    expect(cards[0]?.size).toBe("wide");
    expect(cards[1]?.collapsed).toBe(true);
    expect(cardsFor(state([{ id: "a" }]), payload).map((c) => c.id)).toEqual(["a"]);
  });

  it("skips widgets the server has not calculated and keeps old cards for another view", () => {
    expect(cardsFor(state([{ id: "new" }, { id: "a" }]), payload).map((c) => c.id)).toEqual(["a"]);
    expect(cardsFor({ ...state([]), activeId: "other" }, payload)).toBe(payload.cards);
  });
});
