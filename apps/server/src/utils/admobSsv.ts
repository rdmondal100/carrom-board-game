import { createPublicKey, verify } from 'node:crypto';
import { ADS_CONFIG } from './adsConfig.js';

/**
 * AD-3 AdMob server-side verification. AdMob calls our callback with the
 * reward in the query string; the part before `&signature=` is signed with
 * ECDSA (SHA-256) by one of Google's published keys.
 * https://developers.google.com/admob/android/ssv
 */

export interface SsvKey { keyId: string; pem: string }

/** Where the public keys come from; `refresh` asks for a fresh copy (a key id we don't know). */
export type KeySource = (refresh: boolean) => Promise<SsvKey[]>;

/** One verified rewarded-ad callback. */
export interface SsvReward {
  transactionId: string;
  /** Our user id, set by the app in the ad request's SSV options. */
  userId: string;
  adUnit: string;
  timestamp: number;
}

/** Google's key list, cached for keysTtlMs. `fetchFn` is swappable for tests. */
export function googleKeys(fetchFn: typeof fetch = fetch, nowFn = Date.now): KeySource {
  let cache: { at: number; keys: SsvKey[] } | null = null;
  return async (refresh) => {
    if (cache && !refresh && nowFn() - cache.at < ADS_CONFIG.keysTtlMs) return cache.keys;
    const res = await fetchFn(ADS_CONFIG.keysUrl);
    if (!res.ok) throw new Error(`AdMob keys: HTTP ${res.status}`);
    const body = (await res.json()) as { keys?: { keyId?: unknown; pem?: unknown }[] };
    const keys = (body.keys ?? []).flatMap((k) =>
      (typeof k.pem === 'string' && (typeof k.keyId === 'number' || typeof k.keyId === 'string'))
        ? [{ keyId: String(k.keyId), pem: k.pem }] : []);
    cache = { at: nowFn(), keys };
    return keys;
  };
}

/** The signed message and the signature params, from the raw query string (no leading '?'). */
export function splitSigned(rawQuery: string): { message: string; signature: string; keyId: string } | null {
  const at = rawQuery.indexOf('&signature=');
  if (at <= 0) return null;
  const tail = new URLSearchParams(rawQuery.slice(at + 1));
  const signature = tail.get('signature') ?? '';
  const keyId = tail.get('key_id') ?? '';
  if (!signature || !keyId) return null;
  return { message: rawQuery.slice(0, at), signature, keyId };
}

function checks(message: string, signature: string, pem: string): boolean {
  try {
    return verify('sha256', Buffer.from(message, 'utf8'), createPublicKey(pem), Buffer.from(signature, 'base64url'));
  } catch {
    return false;
  }
}

/** AD-3: the reward if the signature is good, else null. */
export async function verifySsv(rawQuery: string, keys: KeySource): Promise<SsvReward | null> {
  const parts = splitSigned(rawQuery);
  if (!parts) return null;
  let key = (await keys(false)).find((k) => k.keyId === parts.keyId);
  key ??= (await keys(true)).find((k) => k.keyId === parts.keyId);
  if (!key || !checks(parts.message, parts.signature, key.pem)) return null;
  const q = new URLSearchParams(parts.message);
  const transactionId = q.get('transaction_id') ?? '';
  if (!transactionId) return null;
  return {
    transactionId,
    userId: q.get('user_id') ?? '',
    adUnit: q.get('ad_unit') ?? '',
    timestamp: Number(q.get('timestamp') ?? 0),
  };
}
