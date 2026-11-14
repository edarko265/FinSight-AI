import { describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api-client";
import { ConcurrentRunError, createAsyncAction, isApiError } from "@/lib/async-action";

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
  it("drops a second call while pending without callbacks", async () => {
    const d = deferred<number>();
    const fn = vi.fn(() => d.promise);
    const onSuccess = vi.fn();
    const onError = vi.fn();
    const action = createAsyncAction(fn, { onSuccess, onError });
    const first = action.run();
    const second = await action.run();
    expect(second.ok).toBe(false);
    expect(second).toMatchObject({ dropped: true });
    expect(!second.ok && second.error).toBeInstanceOf(ConcurrentRunError);
    expect(action.isPending()).toBe(true);
    d.resolve(1);
    expect(await first).toEqual({ ok: true, value: 1 });
    expect(fn).toHaveBeenCalledTimes(1);
    expect(onSuccess).toHaveBeenCalledTimes(1);
    expect(onError).not.toHaveBeenCalled();
    expect(action.isPending()).toBe(false);
    await action.run();
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("never rejects when callbacks throw", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const ok = createAsyncAction(async () => 1, {
      onPending: () => {
        throw new Error("pending");
      },
      onSuccess: () => {
        throw new Error("success");
      },
    });
    expect(await ok.run()).toEqual({ ok: true, value: 1 });
    expect(ok.isPending()).toBe(false);
    const bad = createAsyncAction(
      async () => {
        throw new Error("x");
      },
      {
        onError: () => {
          throw new Error("handler");
        },
      },
    );
    expect((await bad.run()).ok).toBe(false);
    spy.mockRestore();
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

describe("isApiError", () => {
  it("matches ApiError and optionally its status", () => {
    const error = new ApiError(404, "not_found");
    expect(isApiError(error)).toBe(true);
    expect(isApiError(error, 404)).toBe(true);
    expect(isApiError(error, 401)).toBe(false);
    expect(isApiError(new Error("x"))).toBe(false);
    expect(isApiError("nope", 401)).toBe(false);
  });
});
