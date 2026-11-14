import { ApiError, SIGNED_OUT_EVENT } from "@/lib/api-client";

/**
 * Call on every admin response. A 401 fires the same sign-out event as `api()` and throws an
 * `ApiError` with status 401, so `useAsyncAction` shows no toast (the shell sends the user to sign in).
 */
export function assertSignedIn(response: { status: number }): void {
  if (response.status !== 401) return;
  window.dispatchEvent(new Event(SIGNED_OUT_EVENT));
  throw new ApiError(401, "unauthorized");
}

/**
 * Calls an admin route. Returns null when it failed, so callers can say so instead of failing
 * silently. A 401 throws an `ApiError` (see `assertSignedIn`).
 */
export async function adminCall<T>(
  path: string,
  method = "GET",
  payload?: unknown,
): Promise<T | null> {
  try {
    const response = await fetch(path, {
      method,
      credentials: "same-origin",
      headers: payload === undefined ? undefined : { "Content-Type": "application/json" },
      body: payload === undefined ? undefined : JSON.stringify(payload),
    });
    assertSignedIn(response);
    if (!response.ok) return null;
    return (await response.json()) as T;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    return null;
  }
}

/** As `adminCall`, but also reports the error code, for forms that explain what went wrong. */
export async function adminSubmit<T>(
  path: string,
  method: string,
  payload: unknown,
): Promise<{ ok: true; data: T } | { ok: false; error: string }> {
  try {
    const response = await fetch(path, {
      method,
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    assertSignedIn(response);
    const body = (await response.json().catch(() => null)) as (T & { error?: string }) | null;
    if (!response.ok || !body) return { ok: false, error: body?.error ?? "request_failed" };
    return { ok: true, data: body };
  } catch (error) {
    if (error instanceof ApiError) throw error;
    return { ok: false, error: "request_failed" };
  }
}

/** Turns `adminCall`'s null into a thrown error, so `useAsyncAction` treats a failed call as a failure. */
export function requireResult<T>(result: T | null): T {
  if (result === null) throw new Error("request_failed");
  return result;
}

/** For wizard saves outside `useAsyncAction`: a 401 just keeps the wizard open (the shell signs out). */
export async function unlessSignedOut(run: () => Promise<boolean>): Promise<boolean> {
  try {
    return await run();
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) return false;
    throw error;
  }
}
