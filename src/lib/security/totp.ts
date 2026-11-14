import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * Time-based one-time passwords (RFC 6238): the six-digit codes an
 * authenticator app shows. A second step at sign-in, on top of the password.
 */
const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
const STEP_SECONDS = 30;
const DIGITS = 6;

/** A new shared secret, in the base32 form authenticator apps expect. */
export function newTotpSecret(): string {
  const bytes = randomBytes(20);
  let bits = "";
  for (const byte of bytes) bits += byte.toString(2).padStart(8, "0");
  let out = "";
  for (let index = 0; index + 5 <= bits.length; index += 5) {
    out += ALPHABET[Number.parseInt(bits.slice(index, index + 5), 2)];
  }
  return out;
}

function decode(secret: string): Buffer {
  let bits = "";
  for (const char of secret.replace(/=+$/, "").toUpperCase()) {
    const value = ALPHABET.indexOf(char);
    if (value === -1) continue;
    bits += value.toString(2).padStart(5, "0");
  }
  const bytes: number[] = [];
  for (let index = 0; index + 8 <= bits.length; index += 8) {
    bytes.push(Number.parseInt(bits.slice(index, index + 8), 2));
  }
  return Buffer.from(bytes);
}

/** The code for one 30-second step. */
export function totpCode(secret: string, atMs: number, stepOffset = 0): string {
  const counter = Math.floor(atMs / 1000 / STEP_SECONDS) + stepOffset;
  const message = Buffer.alloc(8);
  message.writeBigUInt64BE(BigInt(counter));
  const digest = createHmac("sha1", decode(secret)).update(message).digest();
  const offset = (digest[digest.length - 1] ?? 0) & 0x0f;
  const binary =
    (((digest[offset] ?? 0) & 0x7f) << 24) |
    ((digest[offset + 1] ?? 0) << 16) |
    ((digest[offset + 2] ?? 0) << 8) |
    (digest[offset + 3] ?? 0);
  return String(binary % 10 ** DIGITS).padStart(DIGITS, "0");
}

/** Accepts the current code and the ones just before and after, to allow for clock drift. */
export function verifyTotp(secret: string, submitted: string, atMs: number): boolean {
  const code = submitted.replace(/\s/g, "");
  if (!/^\d{6}$/.test(code)) return false;
  let ok = false;
  for (const offset of [-1, 0, 1]) {
    const expected = Buffer.from(totpCode(secret, atMs, offset));
    // Compare every candidate, so the time taken does not reveal which one matched.
    if (timingSafeEqual(expected, Buffer.from(code))) ok = true;
  }
  return ok;
}

/** The address an authenticator app reads from a QR code. */
export function totpUri(secret: string, account: string): string {
  const issuer = "FinSight-AI";
  return `otpauth://totp/${encodeURIComponent(`${issuer}:${account}`)}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&digits=${DIGITS}&period=${STEP_SECONDS}`;
}
