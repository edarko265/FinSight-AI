import { getEnv } from "@/lib/env";
import { blindIndex, decodeKey, deriveCustomerKey, type DataKey } from "@/lib/security/crypto";

type KeyRing = { master: DataKey; indexKey: Buffer };

let ring: KeyRing | undefined;

function keyRing(): KeyRing {
  if (!ring) {
    const env = getEnv();
    ring = {
      master: {
        id: env.DATA_ENCRYPTION_KEY_ID,
        key: decodeKey(env.DATA_ENCRYPTION_KEY, "DATA_ENCRYPTION_KEY"),
      },
      indexKey: decodeKey(env.BLIND_INDEX_KEY, "BLIND_INDEX_KEY"),
    };
  }
  return ring;
}

/** Keyed digest of a customer ID: the only form in which it is stored or looked up. */
export function customerRef(customerId: string): string {
  return blindIndex(customerId, keyRing().indexKey, "customers.id");
}

/** Encryption key for one customer, derived from their blind index. */
export function customerKey(ref: string): DataKey {
  return deriveCustomerKey(keyRing().master, ref);
}

/** Key for data that belongs to the service, not to a customer (for example sessions). */
export function serviceKey(purpose: string): DataKey {
  return deriveCustomerKey(keyRing().master, `service:${purpose}`);
}

/** Keyed digest of a staff username: the only form in which it is looked up. */
export function staffIndex(username: string): string {
  return blindIndex(username.trim().toLowerCase(), keyRing().indexKey, "staff.username");
}
