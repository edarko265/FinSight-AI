import { describe, expect, it, vi } from "vitest";
import { createAsyncAction } from "@/lib/async-action";

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

describe("createAsyncAction", () => {
  it("returns the in-flight promise on a second call and runs fn once", async () => {
    const d = deferred<number>();
    const fn = vi.fn(() => d.promise);
    const action = createAsyncAction(fn);
    const first = action.run();
    const second = action.run();
    expect(second).toBe(first);
    expect(action.isPending()).toBe(true);
    d.resolve(1);
    expect(await first).toEqual({ ok: true, value: 1 });
    expect(fn).toHaveBeenCalledTimes(1);
    expect(action.isPending()).toBe(false);
    await action.run();
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("calls onSuccess only on resolve, after pending ends", async () => {
    const events: string[] = [];
    const action = createAsyncAction(async (n: number) => n * 2, {
      onPending: (p) => events.push(`pending:${p}`),
      onSuccess: (v) => events.push(`success:${v}`),
      onError: () => events.push("error"),
    });
    expect(await action.run(4)).toEqual({ ok: true, value: 8 });
    expect(events).toEqual(["pending:true", "pending:false", "success:8"]);
  });

  it("calls onError only on reject and returns the error without throwing", async () => {
    const events: string[] = [];
    const boom = new Error("boom");
    const action = createAsyncAction(
      async () => {
        throw boom;
      },
      {
        onPending: (p) => events.push(`pending:${p}`),
        onSuccess: () => events.push("success"),
        onError: (e) => events.push(e === boom ? "error" : "other"),
      },
    );
    expect(await action.run()).toEqual({ ok: false, error: boom });
    expect(events).toEqual(["pending:true", "pending:false", "error"]);
  });

  it("can run again after a failure", async () => {
    let calls = 0;
    const action = createAsyncAction(async () => {
      calls += 1;
      if (calls === 1) throw new Error("first");
      return "ok";
    });
    expect((await action.run()).ok).toBe(false);
    expect(await action.run()).toEqual({ ok: true, value: "ok" });
  });
});
