/**
 * The open non-modal sheets, oldest first. Escape belongs to the last one opened, so nested
 * sheets close top-first. Pure so it can be tested without a DOM.
 */
export type SheetStack = readonly string[];

/** Adds a sheet on top; one that is already open moves to the top. */
export function pushSheet(stack: SheetStack, id: string): SheetStack {
  return [...stack.filter((item) => item !== id), id];
}

/** Removes a sheet wherever it is in the stack. */
export function popSheet(stack: SheetStack, id: string): SheetStack {
  return stack.filter((item) => item !== id);
}

/** Whether the sheet is the topmost open one. */
export function isTopmostSheet(stack: SheetStack, id: string): boolean {
  return stack.at(-1) === id;
}
