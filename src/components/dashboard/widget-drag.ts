/** Touch needs a hold so ordinary dashboard scrolling is never mistaken for a rearrangement. */
export function dragStartDelay(pointerType: string): number {
  return pointerType === "touch" ? 300 : 0;
}
