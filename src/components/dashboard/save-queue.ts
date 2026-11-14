/**
 * Optimistic saving with coalesced writes. Pure, no React.
 *
 * A change applies to the desired state at once. If no save is running, the desired state is
 * saved. If one is, the queue is marked dirty and, once it settles, the latest desired state
 * is saved a single time, so rapid edits cost two writes at most and none is lost. A failure
 * puts the desired state back to the last confirmed one. Every state sent is computed from the
 * queue's own state, never from a stale render.
 */
export interface SaveQueue<S> {
  /** Applies `change` to the desired state. Resolves true once a save containing it succeeded. */
  change: (change: (state: S) => S) => Promise<boolean>;
  /** The state to show: confirmed plus every change not yet confirmed. Null before `reset`. */
  desired: () => S | null;
  /** True while a save runs or is waiting to run. */
  busy: () => boolean;
  /** Counts changes, so a caller can tell that something changed while it was waiting. */
  version: () => number;
  /** Resolves when no save is running or waiting. */
  idle: () => Promise<void>;
  /** Adopts server state. Ignored while busy, because unsaved changes must not be overwritten. */
  reset: (state: S) => boolean;
}

export interface SaveQueueOptions<S, R> {
  /** State already known when the queue is made, such as the last one shown. */
  initial?: S | null;
  save: (state: S) => Promise<R>;
  /** The desired state or the saving flag changed. */
  onChange?: (desired: S, saving: boolean) => void;
  /** The last queued save succeeded. Earlier responses are dropped, never applied. */
  onSaved?: (response: R) => void;
  /** A save failed and the desired state went back to the confirmed one. */
  onFailed?: (error: unknown) => void;
}

type Waiter = (ok: boolean) => void;

export function createSaveQueue<S, R>(options: SaveQueueOptions<S, R>): SaveQueue<S> {
  let confirmed: S | null = options.initial ?? null;
  let desired: S | null = options.initial ?? null;
  let inFlight = false;
  let dirty = false;
  let counter = 0;
  let unreported: { response: R } | null = null;
  let current: Waiter[] = [];
  let later: Waiter[] = [];
  let idlers: Array<() => void> = [];

  const emit = (): void => {
    if (desired !== null) options.onChange?.(desired, inFlight);
  };

  const settleIdle = (): void => {
    const waiting = idlers;
    idlers = [];
    for (const resolve of waiting) resolve();
  };

  function start(): void {
    if (desired === null) return;
    const snapshot = desired;
    const batch = current;
    current = [];
    inFlight = true;
    dirty = false;
    emit();
    (async () => options.save(snapshot))().then(
      (response) => {
        confirmed = snapshot;
        for (const resolve of batch) resolve(true);
        if (dirty) {
          // Kept in case the follow-up fails: the confirmed state then needs this response.
          unreported = { response };
          current = later;
          later = [];
          start();
          return;
        }
        unreported = null;
        inFlight = false;
        try {
          emit();
          options.onSaved?.(response);
        } catch (callbackError) {
          console.error("save queue callback failed", callbackError);
        } finally {
          settleIdle();
        }
      },
      (error: unknown) => {
        const all = [...batch, ...later];
        const pendingResponse = unreported;
        later = [];
        dirty = false;
        inFlight = false;
        unreported = null;
        desired = confirmed;
        try {
          emit();
          if (pendingResponse) options.onSaved?.(pendingResponse.response);
          options.onFailed?.(error);
        } catch (callbackError) {
          console.error("save queue callback failed", callbackError);
        } finally {
          for (const resolve of all) resolve(false);
          settleIdle();
        }
      },
    );
  }

  return {
    change(change) {
      if (desired === null) return Promise.resolve(false);
      desired = change(desired);
      counter += 1;
      return new Promise<boolean>((resolve) => {
        if (inFlight) {
          later.push(resolve);
          dirty = true;
          emit();
        } else {
          current.push(resolve);
          start();
        }
      });
    },
    desired: () => desired,
    busy: () => inFlight,
    version: () => counter,
    idle: () =>
      inFlight ? new Promise<void>((resolve) => idlers.push(resolve)) : Promise.resolve(),
    reset(state) {
      if (inFlight) return false;
      confirmed = state;
      desired = state;
      emit();
      return true;
    },
  };
}
