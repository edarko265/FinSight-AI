import { ApiError } from "@/lib/api-client";

/** Passed as `error` when a run is dropped because another one is still pending. */
export class ConcurrentRunError extends Error {
  constructor() {
    super("concurrent_run");
    this.name = "ConcurrentRunError";
  }
}

/** True for an `ApiError`, optionally only with the given HTTP status. */
export function isApiError(error: unknown, status?: number): error is ApiError {
  return error instanceof ApiError && (status === undefined || error.status === status);
}

/**
 * Outcome of one run. `run` never rejects. A failure is returned with `ok: false`; a run
 * dropped by the double-run guard also has `dropped: true` and triggers no callbacks.
 */
export type AsyncResult<T> = { ok: true; value: T } | { ok: false; error: unknown; dropped?: true };

export interface AsyncActionOptions<T> {
  onSuccess?: (value: T) => void;
  onError?: (error: unknown) => void;
  /** Called with true when a run starts and false when it settles. */
  onPending?: (pending: boolean) => void;
}

export interface AsyncAction<A extends unknown[], T> {
  /** Starts the action. A call while one is pending is dropped: it resolves to `{ ok: false, dropped: true }`. */
  run: (...args: A) => Promise<AsyncResult<T>>;
  isPending: () => boolean;
}

/** Runs a callback so that a throwing callback cannot break `run`'s never-rejects promise. */
function guard(callback: () => void): void {
  try {
    callback();
  } catch (error) {
    console.error("async action callback failed", error);
  }
}

/**
 * Wraps an async function with a double-run guard and pending reporting. Pure, no React.
 * `onSuccess` runs only on resolve and `onError` only on reject. The error is returned as
 * `{ ok: false, error }` rather than rethrown, and `onError` always sees it. Callbacks that
 * throw are logged and ignored, so `run` never rejects.
 */
export function createAsyncAction<A extends unknown[], T>(
  fn: (...args: A) => Promise<T>,
  options: AsyncActionOptions<T> = {},
): AsyncAction<A, T> {
  let pending = false;

  const run = async (...args: A): Promise<AsyncResult<T>> => {
    if (pending) return { ok: false, error: new ConcurrentRunError(), dropped: true };
    pending = true;
    guard(() => options.onPending?.(true));
    let result: AsyncResult<T>;
    try {
      result = { ok: true, value: await fn(...args) };
    } catch (error) {
      result = { ok: false, error };
    }
    pending = false;
    guard(() => options.onPending?.(false));
    if (result.ok) {
      const { value } = result;
      guard(() => options.onSuccess?.(value));
    } else {
      const { error } = result;
      guard(() => options.onError?.(error));
    }
    return result;
  };

  return { run, isPending: () => pending };
}
