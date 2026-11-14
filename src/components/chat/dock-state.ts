export type DockMode = "closed" | "half" | "full";

export interface DockState {
  mode: DockMode;
  /** True once the coach has been opened; from then on it stays mounted so the conversation survives. */
  mounted: boolean;
  /** A reply arrived while the sheet was closed and has not been seen yet. */
  unread: boolean;
  /** The coach is working on a reply. */
  pending: boolean;
  /** Messages in the current conversation, to tell when a new one arrives. */
  count: number;
  /** Used as the React key of the chat, so a new value starts a fresh conversation. */
  conversation: number;
}

export type DockAction =
  | { type: "open" }
  | { type: "close" }
  | { type: "setMode"; mode: DockMode }
  | { type: "status"; pending: boolean; count: number }
  | { type: "restart" };

export const initialDockState: DockState = {
  mode: "closed",
  mounted: false,
  unread: false,
  pending: false,
  count: 0,
  conversation: 0,
};

export function dockReducer(state: DockState, action: DockAction): DockState {
  switch (action.type) {
    case "open":
      return {
        ...state,
        mounted: true,
        unread: false,
        mode: state.mode === "full" ? "full" : "half",
      };
    case "close":
      return { ...state, mode: "closed" };
    case "setMode":
      return {
        ...state,
        mode: action.mode,
        mounted: state.mounted || action.mode !== "closed",
        unread: action.mode === "closed" ? state.unread : false,
      };
    case "status": {
      const grew = action.count > state.count;
      return {
        ...state,
        pending: action.pending,
        count: action.count,
        unread: state.unread || (state.mode === "closed" && state.mounted && grew),
      };
    }
    case "restart":
      return { ...state, conversation: state.conversation + 1, pending: false, count: 0, unread: false };
  }
}
