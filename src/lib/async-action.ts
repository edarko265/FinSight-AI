/** Outcome of one run. `run` never rejects: a failure is reported through `onError` and returned here. */
export type AsyncResult<T> = { ok: true; value: T } | { ok: false; error: unknown };

export interface AsyncActionOptions<T> {
  onSuccess?: (value: T) => void;
  onError?: (error: unknown) => void;
  /** Called with true when a run starts and false when it settles. */
  onPending?: (pending: boolean) => void;
}

export interface AsyncAction<A extends unknown[], T> {
  /** Starts the action. A call while one is pending returns the in-flight promise and does not start another. */
  run: (...args: A) => Promise<AsyncResult<T>>;
  isPending: () => boolean;
}

/**
 * Wraps an async function with a double-run guard and pending reporting. Pure, no React.
 * `onSuccess` runs only on resolve and `onError` only on reject. The error is returned as
 * `{ ok: false, error }` rather than rethrown, so callers cannot miss it by forgetting a catch,
 * and it is never dropped: `onError` always sees it.
 */
export function createAsyncAction<A extends unknown[], T>(
  fn: (...args: A) => Promise<T>,
  options: AsyncActionOptions<T> = {},
): AsyncAction<A, T> {
  let inFlight: Promise<AsyncResult<T>> | null = null;

  const run = (...args: A): Promise<AsyncResult<T>> => {
    if (inFlight) return inFlight;
    options.onPending?.(true);
    const current = (async (): Promise<AsyncResult<T>> => {
      let result: AsyncResult<T>;
      try {
        result = { ok: true, value: await fn(...args) };
      } catch (error) {
        result = { ok: false, error };
      }
      inFlight = null;
      options.onPending?.(false);
      if (result.ok) options.onSuccess?.(result.value);
      else options.onError?.(result.error);
      return result;
    })();
    inFlight = current;
    return current;
  };

  return { run, isPending: () => inFlight !== null };
}
