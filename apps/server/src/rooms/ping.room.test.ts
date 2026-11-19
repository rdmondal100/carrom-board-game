import { boot, type ColyseusTestServer } from '@colyseus/testing';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createServer } from '../app.js';

const ORIGINS = ['http://localhost:5173'];

describe('colyseus', () => {
  let colyseus: ColyseusTestServer;

  beforeAll(async () => {
    const { gameServer } = createServer({ CORS_ORIGIN: ORIGINS, NODE_ENV: 'test', JWT_SECRET: 'x'.repeat(32), GOOGLE_CLIENT_IDS: [] });
    colyseus = await boot(gameServer);
  });

  afterAll(async () => {
    await colyseus.shutdown();
  });

  it('SRV-5 a test client joins ping and gets a reply', async () => {
    const room = await colyseus.createRoom('ping');
    const client = await colyseus.connectTo(room);
    const reply = new Promise<unknown>((resolve) => client.onMessage('pong', resolve));
    client.send('ping', { n: 7 });
    await expect(reply).resolves.toEqual({ n: 7 });
    await client.leave();
  });

  it('SRV-5 Express routes are served on the same HTTP server', async () => {
    const res = await colyseus.http.get('/health');
    expect(res.statusCode).toBe(200);
    expect((res.data as { ok: boolean }).ok).toBe(true);
  });

  it('SRV-4 Colyseus routes only allow listed origins', async () => {
    const ok = await colyseus.http.get('/health', { headers: { Origin: ORIGINS[0]! } });
    expect(ok.headers['access-control-allow-origin']).toBe(ORIGINS[0]);
    const bad = await colyseus.http.get('/health', { headers: { Origin: 'https://evil.example' } });
    expect(bad.headers['access-control-allow-origin']).toBeUndefined();
  });
});
