import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { iceServersFor, TURN_TTL_S, turnCredential } from './turn.js';

const SECRET = 'coturn-static-auth-secret';
const NOW = 1_763_600_000_123;

describe('TURN credentials', () => {
  it('VOICE-3 username = expiry:userId, password = base64 HMAC-SHA1 (coturn REST scheme)', () => {
    const c = turnCredential(SECRET, 'u1', NOW);
    const expiry = Math.floor(NOW / 1000) + TURN_TTL_S;
    expect(c.username).toBe(`${expiry}:u1`);
    // What coturn computes for `use-auth-secret`: base64(hmac-sha1(static-auth-secret, username)).
    expect(c.credential).toBe(createHmac('sha1', SECRET).update(`${expiry}:u1`).digest('base64'));
    expect(TURN_TTL_S).toBeLessThanOrEqual(3600);
  });

  it('VOICE-3 TURN only with a secret; STUN always', () => {
    const stunOnly = iceServersFor({ stunUrls: ['stun:a:3478'] }, 'u1', NOW);
    expect(stunOnly).toEqual({ iceServers: [{ urls: ['stun:a:3478'] }], ttl: TURN_TTL_S });
    const both = iceServersFor({ stunUrls: ['stun:a:3478'], turnUrls: ['turn:t:3478', 'turns:t:5349'], turnSecret: SECRET }, 'u1', NOW);
    expect(both.iceServers[1]).toEqual({ urls: ['turn:t:3478', 'turns:t:5349'], ...turnCredential(SECRET, 'u1', NOW) });
    expect(JSON.stringify(both)).not.toContain(SECRET);
  });
});
