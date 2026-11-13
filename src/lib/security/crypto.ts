import { createCipheriv, createDecipheriv, createHmac, hkdfSync, randomBytes } from "node:crypto";

/**
 * Field-level encryption for data at rest.
 *
 * Rule: no customer or transaction value is written to the database in
 * plaintext. Values are sealed with AES-256-GCM before they leave the
 * application, and lookups use keyed blind indexes instead of raw identifiers.
 * Disk encryption and TLS still apply underneath; this layer means a database
 * dump, backup or administrator account alone reveals nothing readable.
 *
 * Server-only. Never import this module from a client component.
 * See docs/security.md.
 */

const ALGORITHM = "aes-256-gcm";
const KEY_BYTES = 32;
const IV_BYTES = 12;
const TAG_BYTES = 16;
const FORMAT_VERSION = "v1";

export class CryptoError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CryptoError";
  }
}

export type DataKey = {
  /** Identifier stored beside each ciphertext so keys can be rotated. */
  readonly id: string;
  readonly key: Buffer;
};

/** Decodes and validates a base64 key. Never logs or echoes the value. */
export function decodeKey(base64: string | undefined, name: string): Buffer {
  if (!base64) {
    throw new CryptoError(`${name} is not set`);
  }
  const key = Buffer.from(base64, "base64");
  if (key.length !== KEY_BYTES) {
    throw new CryptoError(`${name} must be ${KEY_BYTES} bytes, base64 encoded`);
  }
  return key;
}

/**
 * Derives a per-customer key from the master key, so one customer's data
 * cannot be decrypted with another customer's key, and a customer's data can
 * be made unreadable by retiring their key.
 */
export function deriveCustomerKey(master: DataKey, customerRef: string): DataKey {
  const derived = hkdfSync(
    "sha256",
    master.key,
    Buffer.alloc(0),
    `finsight:customer:${customerRef}`,
    KEY_BYTES,
  );
  return { id: master.id, key: Buffer.from(derived) };
}

/**
 * Encrypts a value. `context` is bound to the ciphertext as authenticated
 * data (for example "transactions.amount"), so a sealed value copied into a
 * different column or row fails to decrypt.
 */
export function encryptField(plaintext: string, dataKey: DataKey, context: string): string {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, dataKey.key, iv);
  cipher.setAAD(Buffer.from(context, "utf8"));
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const payload = Buffer.concat([iv, cipher.getAuthTag(), ciphertext]).toString("base64");
  return `${FORMAT_VERSION}.${dataKey.id}.${payload}`;
}

/** Decrypts a value produced by `encryptField`. Throws if it was altered. */
export function decryptField(sealed: string, dataKey: DataKey, context: string): string {
  const [version, keyId, payload, ...rest] = sealed.split(".");
  if (version !== FORMAT_VERSION || !keyId || !payload || rest.length > 0) {
    throw new CryptoError("Unrecognised ciphertext format");
  }
  if (keyId !== dataKey.id) {
    throw new CryptoError("Ciphertext was sealed with a different key");
  }

  const raw = Buffer.from(payload, "base64");
  if (raw.length < IV_BYTES + TAG_BYTES) {
    throw new CryptoError("Ciphertext is truncated");
  }

  const decipher = createDecipheriv(ALGORITHM, dataKey.key, raw.subarray(0, IV_BYTES));
  decipher.setAAD(Buffer.from(context, "utf8"));
  decipher.setAuthTag(raw.subarray(IV_BYTES, IV_BYTES + TAG_BYTES));
  try {
    return Buffer.concat([
      decipher.update(raw.subarray(IV_BYTES + TAG_BYTES)),
      decipher.final(),
    ]).toString("utf8");
  } catch {
    throw new CryptoError("Ciphertext failed authentication");
  }
}

/**
 * Keyed, deterministic digest used to look a record up without storing the
 * raw identifier. Uses a key separate from the encryption key.
 */
export function blindIndex(value: string, indexKey: Buffer, context: string): string {
  return createHmac("sha256", indexKey).update(`${context}:${value}`, "utf8").digest("base64url");
}
