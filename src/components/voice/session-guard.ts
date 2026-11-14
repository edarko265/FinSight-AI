/**
 * Makes sure a voice session is ended once, yet still ended when it starts after an earlier
 * cleanup (React StrictMode runs mount, cleanup, mount, and the first start resolves late).
 */
export interface SessionGuard {
  /** Call when the session has actually started: it is live again, so it may be ended. */
  started: () => void;
  /** True the first time per live session, when the caller should end it. */
  end: () => boolean;
}

export function createSessionGuard(): SessionGuard {
  let ended = false;
  return {
    started: () => {
      ended = false;
    },
    end: () => {
      if (ended) return false;
      ended = true;
      return true;
    },
  };
}
