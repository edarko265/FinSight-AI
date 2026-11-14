import { timingSafeEqual } from "node:crypto";

const WIDTH = 1024;

/**
 * Compares two secrets without the time taken revealing where they differ.
 * Both are copied into buffers of the same fixed size, so the comparison
 * always does the same amount of work whatever was submitted.
 */
export function secretsMatch(submitted: string, expected: string): boolean {
  const a = Buffer.alloc(WIDTH);
  const b = Buffer.alloc(WIDTH);
  const written = a.write(submitted, "utf8");
  const wanted = b.write(expected, "utf8");
  const same = timingSafeEqual(a, b);
  // Anything longer than the buffer was cut off and can never match.
  return (
    same &&
    written === wanted &&
    Buffer.byteLength(submitted, "utf8") <= WIDTH &&
    Buffer.byteLength(expected, "utf8") <= WIDTH
  );
}
