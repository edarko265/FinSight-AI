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

/**
 * What the app last read, kept in memory for this tab only, so a screen the
 * customer comes back to shows at once and is then brought up to date. It is
 * emptied whenever someone signs in or out, so nothing carries over.
 */
const remembered = new Map<string, unknown>();
const inFlight = new Map<string, Promise<unknown>>();

/** The last answer to a GET, if there is one. */
export function peek<T>(path: string): T | undefined {
  return remembered.get(path) as T | undefined;
}

/** Stores an answer, for example the result of a save, as the latest for a path. */
export function remember(path: string, value: unknown): void {
  remembered.set(path, value);
}

function forgetAll(): void {
  remembered.clear();
  inFlight.clear();
}

/** A GET that is shared by everyone asking for the same path at the same time. */
export function load<T>(path: string): Promise<T> {
  const running = inFlight.get(path);
  if (running) return running as Promise<T>;
  const request = api<T>(path)
    .then((value) => {
      // Only if nobody signed out while it was on its way.
      if (inFlight.get(path) === request) remembered.set(path, value);
      return value;
    })
    .finally(() => {
      if (inFlight.get(path) === request) inFlight.delete(path);
    });
  inFlight.set(path, request);
  return request;
}

export async function api<T>(path: string, init?: RequestInit & { json?: unknown }): Promise<T> {
  const { json, ...rest } = init ?? {};
  if (path.startsWith("/api/auth/")) forgetAll();
  const response = await fetch(path, {
    ...rest,
    credentials: "same-origin",
    headers:
      json === undefined ? rest.headers : { "Content-Type": "application/json", ...rest.headers },
    body: json === undefined ? rest.body : JSON.stringify(json),
  });
  if (response.status === 401 && !path.startsWith("/api/auth/")) {
    forgetAll();
    window.dispatchEvent(new Event(SIGNED_OUT_EVENT));
  }
  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new ApiError(response.status, payload?.error ?? "request_failed");
  }
  return (await response.json()) as T;
}
