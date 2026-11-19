import request from 'supertest';
import { afterAll, describe, expect, inject, it } from 'vitest';
import { createApp, type AppEnv } from './app.js';
import { connectDb, disconnectDb } from './connectDb.js';
import { VERSION } from './utils/version.js';

const ORIGINS = ['http://localhost:5173', 'capacitor://localhost', 'https://localhost'];
const devEnv: AppEnv = { CORS_ORIGIN: ORIGINS, NODE_ENV: 'development' };
const prodEnv: AppEnv = { CORS_ORIGIN: ORIGINS, NODE_ENV: 'production' };

/** An app with one extra route that throws, mounted before the 404 handler. */
function appWithThrow(env: AppEnv) {
  const app = createApp(env);
  const stack = (app as unknown as { router: { stack: unknown[] } }).router.stack;
  app.get('/boom', () => {
    throw new Error('kaboom');
  });
  // Move the new route above notFound and errorHandler (the last two layers).
  const layer = stack.pop();
  stack.splice(stack.length - 2, 0, layer);
  return app;
}

describe('health', () => {
  afterAll(async () => {
    await disconnectDb();
  });

  it('SRV-2 /health reports db down before connecting', async () => {
    const res = await request(createApp(devEnv)).get('/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true, version: VERSION, db: 'down' });
  });

  it('SRV-2 /health with mongodb-memory-server → db up', async () => {
    await connectDb(inject('mongoUri'));
    const res = await request(createApp(devEnv)).get('/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true, version: VERSION, db: 'up' });
  });
});

describe('errors', () => {
  it('SRV-3 unknown route → 404 { error }', async () => {
    const res = await request(createApp(prodEnv)).get('/nope');
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: expect.any(String) });
  });

  it('SRV-3 thrown error → 500 { error } with a stack outside production', async () => {
    const res = await request(appWithThrow(devEnv)).get('/boom');
    expect(res.status).toBe(500);
    expect(typeof res.body.error).toBe('string');
    expect(res.body.stack).toMatch(/kaboom/);
  });

  it('SRV-3 thrown error in production → 500 { error } and no stack', async () => {
    const res = await request(appWithThrow(prodEnv)).get('/boom');
    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: expect.any(String) });
    expect(JSON.stringify(res.body)).not.toMatch(/kaboom|at /);
  });

  it('SRV-3 bad JSON body → 400 { error }', async () => {
    const res = await request(createApp(prodEnv))
      .post('/health').set('Content-Type', 'application/json').send('{bad');
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: expect.any(String) });
  });
});

describe('cors', () => {
  it.each(ORIGINS)('SRV-4 allowed origin %s gets the CORS header', async (origin) => {
    const res = await request(createApp(devEnv)).get('/health').set('Origin', origin);
    expect(res.headers['access-control-allow-origin']).toBe(origin);
  });

  it('SRV-4 other origin gets no CORS header', async () => {
    const res = await request(createApp(devEnv)).get('/health').set('Origin', 'https://evil.example');
    expect(res.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('SRV-4 preflight from an allowed origin is answered', async () => {
    const res = await request(createApp(devEnv))
      .options('/health').set('Origin', ORIGINS[0]!).set('Access-Control-Request-Method', 'POST');
    expect(res.status).toBe(204);
    expect(res.headers['access-control-allow-origin']).toBe(ORIGINS[0]);
  });
});
