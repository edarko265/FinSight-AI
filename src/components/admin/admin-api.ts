/** Calls an admin route. Returns null when it failed, so callers can say so instead of failing silently. */
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
    if (!response.ok) return null;
    return (await response.json()) as T;
  } catch {
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
    const body = (await response.json().catch(() => null)) as (T & { error?: string }) | null;
    if (!response.ok || !body) return { ok: false, error: body?.error ?? "request_failed" };
    return { ok: true, data: body };
  } catch {
    return { ok: false, error: "request_failed" };
  }
}
