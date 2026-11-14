/** Pure state of one screen load, kept apart from React so the key and retry rules can be tested. */
export interface LoadState<T> {
  /** What the data was loaded for, for example the locale. */
  key: unknown;
  data: T | null;
  failed: boolean;
  loading: boolean;
}

export type LoadAction<T> =
  | { type: "start"; key: unknown }
  | { type: "success"; key: unknown; data: T }
  | { type: "failure"; key: unknown }
  | { type: "update"; key: unknown; update: (current: T | null) => T | null };

export function initialLoadState<T>(key: unknown): LoadState<T> {
  return { key, data: null, failed: false, loading: true };
}

/**
 * Data loaded for another key is never shown: an action for a new key starts from an empty
 * state, so stale data (such as the old language) and an old failure disappear at once.
 * A retry (`start` for the same key) keeps the data, clears the failure and sets `loading`.
 */
export function loadReducer<T>(state: LoadState<T>, action: LoadAction<T>): LoadState<T> {
  const base = Object.is(state.key, action.key) ? state : initialLoadState<T>(action.key);
  switch (action.type) {
    case "start":
      return { ...base, failed: false, loading: true };
    case "success":
      return { ...base, data: action.data, failed: false, loading: false };
    case "failure":
      return { ...base, failed: true, loading: false };
    case "update":
      return { ...base, data: action.update(base.data) };
  }
}
