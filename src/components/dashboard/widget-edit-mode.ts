export type WidgetMode = "view" | "editing";
export type WidgetModeEvent = "long-press" | "tap-surface";

/** A long press exposes widget controls; a later empty-surface tap returns it to reading mode. */
export function nextWidgetMode(mode: WidgetMode, event: WidgetModeEvent): WidgetMode {
  if (event === "long-press") return "editing";
  return mode === "editing" ? "view" : mode;
}
