import { createHmac } from 'node:crypto';
import type { IceResponse, IceServer } from '@carrom/protocol/api';

/** VOICE-3 TURN credentials last one hour (the client fetches new ones per room). */
export const TURN_TTL_S = 3600;

export interface IceConfig {
  stunUrls: readonly string[];
  /** Both set, or both missing (STUN only). The secret never leaves the server. */
  turnUrls?: readonly string[];
  turnSecret?: string;
}

/**
 * VOICE-3 coturn's REST API scheme (`use-auth-secret` + `static-auth-secret`):
 * username = "<expiry unix seconds>:<userId>", password = base64(HMAC-SHA1(secret, username)).
 */
export function turnCredential(
  secret: string, userId: string, nowMs: number, ttlS = TURN_TTL_S,
): { username: string; credential: string } {
  const username = `${Math.floor(nowMs / 1000) + ttlS}:${userId}`;
  const credential = createHmac('sha1', secret).update(username).digest('base64');
  return { username, credential };
}

/** VOICE-3 the ICE servers one signed-in player gets: STUN, plus TURN with short-lived credentials. */
export function iceServersFor(cfg: IceConfig, userId: string, nowMs = Date.now()): IceResponse {
  const iceServers: IceServer[] = [{ urls: [...cfg.stunUrls] }];
  if (cfg.turnUrls?.length && cfg.turnSecret) {
    iceServers.push({ urls: [...cfg.turnUrls], ...turnCredential(cfg.turnSecret, userId, nowMs) });
  }
  return { iceServers, ttl: TURN_TTL_S };
}
