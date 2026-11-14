import { randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";

import {
  CryptoError,
  blindIndex,
  decodeKey,
  decryptField,
  deriveCustomerKey,
  encryptField,
  type DataKey,
} from "@/lib/security/crypto";

const master: DataKey = { id: "k1", key: randomBytes(32) };
const CONTEXT = "transactions.amount";

describe("encryptField / decryptField", () => {
  it("round-trips a value", () => {
    const sealed = encryptField("-1043.07", master, CONTEXT);
    expect(decryptField(sealed, master, CONTEXT)).toBe("-1043.07");
  });

  it("never contains the plaintext and differs on every call", () => {
    const first = encryptField("Groceries", master, CONTEXT);
    const second = encryptField("Groceries", master, CONTEXT);
    expect(first).not.toContain("Groceries");
    expect(first).not.toBe(second);
  });

  it("fails when the ciphertext is altered", () => {
    const sealed = encryptField("100.00", master, CONTEXT);
    const [version, keyId, payload = ""] = sealed.split(".");
    const raw = Buffer.from(payload, "base64");
    raw[raw.length - 1] = (raw[raw.length - 1] ?? 0) ^ 1;
    const tampered = `${version}.${keyId}.${raw.toString("base64")}`;
    expect(() => decryptField(tampered, master, CONTEXT)).toThrow(CryptoError);
  });

  it("fails when a value is moved to a different column", () => {
    const sealed = encryptField("100.00", master, CONTEXT);
    expect(() => decryptField(sealed, master, "transactions.balance")).toThrow(CryptoError);
  });

  it("fails with the wrong key or key id", () => {
    const sealed = encryptField("100.00", master, CONTEXT);
    expect(() => decryptField(sealed, { id: "k1", key: randomBytes(32) }, CONTEXT)).toThrow(
      CryptoError,
    );
    expect(() => decryptField(sealed, { id: "k2", key: master.key }, CONTEXT)).toThrow(CryptoError);
  });

  it("rejects malformed input", () => {
    expect(() => decryptField("not-a-ciphertext", master, CONTEXT)).toThrow(CryptoError);
    expect(() => decryptField("v1.k1.AAAA", master, CONTEXT)).toThrow(CryptoError);
  });
});

describe("deriveCustomerKey", () => {
  it("is stable per customer and isolates customers from each other", () => {
    const a = deriveCustomerKey(master, "customer-a");
    const b = deriveCustomerKey(master, "customer-b");
    expect(deriveCustomerKey(master, "customer-a").key.equals(a.key)).toBe(true);
    expect(a.key.equals(b.key)).toBe(false);

    const sealed = encryptField("secret", a, CONTEXT);
    expect(decryptField(sealed, a, CONTEXT)).toBe("secret");
    expect(() => decryptField(sealed, b, CONTEXT)).toThrow(CryptoError);
  });
});

describe("blindIndex", () => {
  const indexKey = randomBytes(32);

  it("is deterministic for the same input", () => {
    expect(blindIndex("C-001", indexKey, "customers.id")).toBe(
      blindIndex("C-001", indexKey, "customers.id"),
    );
  });

  it("changes with the value, the context and the key", () => {
    const base = blindIndex("C-001", indexKey, "customers.id");
    expect(blindIndex("C-002", indexKey, "customers.id")).not.toBe(base);
    expect(blindIndex("C-001", indexKey, "accounts.id")).not.toBe(base);
    expect(blindIndex("C-001", randomBytes(32), "customers.id")).not.toBe(base);
    expect(base).not.toContain("C-001");
  });
});

describe("decodeKey", () => {
  it("accepts a 32-byte base64 key", () => {
    expect(decodeKey(randomBytes(32).toString("base64"), "DATA_ENCRYPTION_KEY")).toHaveLength(32);
  });

  it("rejects a missing or short key without echoing it", () => {
    expect(() => decodeKey(undefined, "DATA_ENCRYPTION_KEY")).toThrow(CryptoError);
    const short = randomBytes(8).toString("base64");
    expect(() => decodeKey(short, "DATA_ENCRYPTION_KEY")).toThrow(
      "DATA_ENCRYPTION_KEY must be 32 bytes, base64 encoded",
    );
  });
});

describe("comparing secrets", () => {
  it("matches only the exact secret, whatever the lengths", async () => {
    const { secretsMatch } = await import("@/lib/security/compare");
    expect(secretsMatch("correct horse", "correct horse")).toBe(true);
    expect(secretsMatch("correct horse", "correct hors")).toBe(false);
    expect(secretsMatch("correct hors", "correct horse")).toBe(false);
    expect(secretsMatch("", "correct horse")).toBe(false);
    expect(secretsMatch("pässi-ä", "pässi-ä")).toBe(true);
    // Longer than the comparison buffer: refused even if the first part is the same.
    const long = "x".repeat(2000);
    expect(secretsMatch(long, long)).toBe(false);
  });
});

describe("the boot script", () => {
  it("carries the same storage key and text sizes as the app", async () => {
    const { FONT_SIZES, PREFERENCES_BOOT_SCRIPT, PREFS_STORAGE_KEY } =
      await import("@/components/providers/PreferencesProvider");
    expect(PREFERENCES_BOOT_SCRIPT).toContain(JSON.stringify(PREFS_STORAGE_KEY));
    expect(PREFERENCES_BOOT_SCRIPT).toContain(JSON.stringify(FONT_SIZES));
  });
});

describe("one-time codes", () => {
  it("matches the published test values (RFC 6238, SHA-1)", async () => {
    const { totpCode, verifyTotp } = await import("@/lib/security/totp");
    // The RFC's shared secret "12345678901234567890", in base32.
    const secret = "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ";
    expect(totpCode(secret, 59_000)).toBe("287082");
    expect(totpCode(secret, 1_111_111_109_000)).toBe("081804");
    expect(totpCode(secret, 1_234_567_890_000)).toBe("005924");
    // The neighbouring 30-second steps are accepted; anything further away is not.
    expect(verifyTotp(secret, "287082", 59_000 + 30_000)).toBe(true);
    expect(verifyTotp(secret, "287 082", 59_000)).toBe(true);
    expect(verifyTotp(secret, "287082", 59_000 + 90_000)).toBe(false);
    expect(verifyTotp(secret, "000000", 59_000)).toBe(false);
    expect(verifyTotp(secret, "28708", 59_000)).toBe(false);
  });

  it("makes secrets an authenticator app can read", async () => {
    const { newTotpSecret, totpCode, totpUri, verifyTotp } = await import("@/lib/security/totp");
    const secret = newTotpSecret();
    expect(secret).toMatch(/^[A-Z2-7]{32}$/);
    expect(verifyTotp(secret, totpCode(secret, 1_000_000), 1_000_000)).toBe(true);
    expect(totpUri(secret, "CUST1")).toContain(`secret=${secret}`);
  });
});
