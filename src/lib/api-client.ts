/** Small fetch helper for the app's own API. A lost session sends the user back to sign in. */
/** Fired when the server no longer recognises the session. */
export const SIGNED_OUT_EVENT = "finsight:signed-out";

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
  ) {
    super(code);
    this.name = "ApiError";
  }
}

export async function api<T>(path: string, init?: RequestInit & { json?: unknown }): Promise<T> {
  const { json, ...rest } = init ?? {};
  const response = await fetch(path, {
    ...rest,
    credentials: "same-origin",
    headers:
      json === undefined ? rest.headers : { "Content-Type": "application/json", ...rest.headers },
    body: json === undefined ? rest.body : JSON.stringify(json),
  });
  if (response.status === 401 && !path.startsWith("/api/auth/")) {
    window.dispatchEvent(new Event(SIGNED_OUT_EVENT));
  }
  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new ApiError(response.status, payload?.error ?? "request_failed");
  }
  return (await response.json()) as T;
}
