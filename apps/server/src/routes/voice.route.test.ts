import { createHmac } from 'node:crypto';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import type { IceResponse } from '@carrom/protocol/api';
import { createApp, type AppEnv } from '../app.js';
import { signToken } from '../utils/jwt.js';

const SECRET = 'v'.repeat(32);
const TURN_SECRET = 'turn-shared-secret-123';
const USER_ID = '6650f0c2a1b2c3d4e5f60718';
const base: AppEnv = { CORS_ORIGIN: ['http://localhost:5173'], NODE_ENV: 'test', JWT_SECRET: SECRET, GOOGLE_CLIENT_IDS: [] };
const bearer = `Bearer ${signToken(USER_ID, SECRET)}`;

describe('GET /voice/ice', () => {
  it('VOICE-3 needs sign-in', async () => {
    const app = createApp(base);
    expect((await request(app).get('/voice/ice')).status).toBe(401);
    expect((await request(app).get('/voice/ice').set('Authorization', 'Bearer nope')).status).toBe(401);
  });

  it('VOICE-3 credentials: username = expiry:userId, HMAC-SHA1 matches coturn', async () => {
    const app = createApp({ ...base, TURN_URLS: ['turn:turn.example.com:3478'], TURN_SECRET, STUN_URLS: ['stun:turn.example.com:3478'] });
    const before = Math.floor(Date.now() / 1000);
    const res = await request(app).get('/voice/ice').set('Authorization', bearer);
    expect(res.status).toBe(200);
    expect(res.headers['cache-control']).toBe('no-store');
    const body = res.body as IceResponse;
    expect(body.ttl).toBeLessThanOrEqual(3600);
    expect(body.iceServers[0]).toEqual({ urls: ['stun:turn.example.com:3478'] });
    const turn = body.iceServers[1]!;
    expect(turn.urls).toEqual(['turn:turn.example.com:3478']);
    const [expiry, userId] = turn.username!.split(':');
    expect(userId).toBe(USER_ID);
    expect(Number(expiry) - before).toBeGreaterThanOrEqual(body.ttl - 1);
    expect(Number(expiry) - before).toBeLessThanOrEqual(body.ttl + 1);
    expect(turn.credential).toBe(createHmac('sha1', TURN_SECRET).update(turn.username!).digest('base64'));
    expect(JSON.stringify(body)).not.toContain(TURN_SECRET);
  });

  it('VOICE-3 no TURN configured → STUN only (Google public by default)', async () => {
    const res = await request(createApp(base)).get('/voice/ice').set('Authorization', bearer);
    expect(res.status).toBe(200);
    expect((res.body as IceResponse).iceServers).toEqual([{ urls: ['stun:stun.l.google.com:19302'] }]);
  });
});
