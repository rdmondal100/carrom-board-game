import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, inject, it, vi } from 'vitest';
import { createApp, type AppEnv } from '../app.js';
import { connectDb, disconnectDb } from '../connectDb.js';
import { BAD_LOGIN, GOOGLE_OFF } from '../controllers/auth.controller.js';
import { RATE_LIMITED } from '../middleware/rateLimit.middleware.js';
import { User } from '../models/user.model.js';
import { verifyGoogleIdToken, type GoogleIdentity } from '../utils/google.js';
import { signToken } from '../utils/jwt.js';

vi.mock('../utils/google.js', () => ({ verifyGoogleIdToken: vi.fn() }));
const verifyMock = vi.mocked(verifyGoogleIdToken);

const SECRET = 'k'.repeat(32);
const env: AppEnv = {
  CORS_ORIGIN: ['http://localhost:5173'], NODE_ENV: 'test', JWT_SECRET: SECRET,
  GOOGLE_CLIENT_IDS: ['web.apps.googleusercontent.com'],
};
/** No rate limit in the way except in the AUTH-7 test. */
const app = createApp(env, { authRateLimit: 10_000 });
const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });

async function newGuest(name?: string) {
  const res = await request(app).post('/auth/guest').send(name ? { name } : {});
  expect(res.status).toBe(201);
  return res.body as { token: string; user: { id: string; name: string } };
}

async function registered(email = 'rina@example.com', password = 'correct horse') {
  const res = await request(app).post('/auth/register').send({ name: 'Rina', email, password });
  expect(res.status).toBe(201);
  return res.body as { token: string; user: { id: string } };
}

const googleId = (over: Partial<GoogleIdentity> = {}): GoogleIdentity =>
  ({ googleId: 'g-123', email: 'gina@gmail.com', name: 'Gina Rahman', ...over });

describe('auth routes', () => {
  beforeAll(async () => {
    await connectDb(inject('mongoUri'));
    await User.syncIndexes();
  });
  beforeEach(async () => {
    await User.deleteMany({});
    verifyMock.mockReset();
  });
  afterAll(async () => {
    await disconnectDb();
  });

  describe('AUTH-2 guest', () => {
    it('AUTH-2 guest gets a token that /auth/me accepts', async () => {
      const { token, user } = await newGuest();
      expect(user.name).toMatch(/^Player-\d{4}$/);
      const me = await request(app).get('/auth/me').set(bearer(token));
      expect(me.status).toBe(200);
      expect(me.body.user).toMatchObject({ id: user.id, isGuest: true, rating: 1000, coins: 0 });
    });

    it('AUTH-2 guest keeps a given name; a bad name is 400', async () => {
      expect((await newGuest('  Tuhin ')).user.name).toBe('Tuhin');
      const res = await request(app).post('/auth/guest').send({ name: 'ab' });
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/3–20/);
    });
  });

  describe('AUTH-3 register', () => {
    it('AUTH-3 register creates a new user', async () => {
      const res = await request(app).post('/auth/register')
        .send({ name: 'Rina', email: ' Rina@Example.com ', password: 'correct horse' });
      expect(res.status).toBe(201);
      expect(res.body.user).toMatchObject({ name: 'Rina', email: 'rina@example.com', isGuest: false, hasPassword: true });
      const doc = await User.findById(res.body.user.id);
      expect(doc?.passwordHash).toMatch(/^\$2[aby]\$12\$/);
      expect(JSON.stringify(res.body)).not.toMatch(/passwordHash|correct horse/);
    });

    it('AUTH-3 upgrade guest keeps id, rating, coins', async () => {
      const g = await newGuest();
      await User.updateOne({ _id: g.user.id }, { 'ratings.carrom': { rating: 1234, games: 2 }, coins: 50 });
      const res = await request(app).post('/auth/register').set(bearer(g.token))
        .send({ name: 'Rina', email: 'rina@example.com', password: 'correct horse' });
      expect(res.status).toBe(200);
      expect(res.body.user).toMatchObject({ id: g.user.id, rating: 1234, coins: 50, isGuest: false, name: 'Rina' });
      expect(res.body.user.ratings).toEqual({ carrom: { rating: 1234, games: 2 } });
      expect(await User.countDocuments({})).toBe(1);
    });

    it('AUTH-3 a registered user\'s token makes a new user, not an upgrade', async () => {
      const a = await registered();
      const res = await request(app).post('/auth/register').set(bearer(a.token))
        .send({ name: 'Tuhin', email: 'tuhin@example.com', password: 'correct horse' });
      expect(res.status).toBe(201);
      expect(res.body.user.id).not.toBe(a.user.id);
    });

    it('AUTH-3 409 on taken email (any case)', async () => {
      await registered();
      const res = await request(app).post('/auth/register')
        .send({ name: 'Other', email: 'RINA@example.com', password: 'another one' });
      expect(res.status).toBe(409);
      expect(res.body).toEqual({ error: expect.any(String) });
    });

    it('AUTH-3 short password 400', async () => {
      const res = await request(app).post('/auth/register')
        .send({ name: 'Rina', email: 'rina@example.com', password: '1234567' });
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/at least 8/);
    });

    it('AUTH-3 bad email, bad name, missing fields 400', async () => {
      const send = (body: object) => request(app).post('/auth/register').send(body);
      expect((await send({ name: 'Rina', email: 'nope', password: 'correct horse' })).status).toBe(400);
      expect((await send({ name: 'Ri', email: 'r@example.com', password: 'correct horse' })).status).toBe(400);
      expect((await send({ email: 'r@example.com', password: 'correct horse' })).status).toBe(400);
    });
  });

  describe('AUTH-4 login', () => {
    it('AUTH-4 login ok', async () => {
      const a = await registered();
      const res = await request(app).post('/auth/login').send({ email: 'Rina@example.com', password: 'correct horse' });
      expect(res.status).toBe(200);
      expect(res.body.user.id).toBe(a.user.id);
      expect((await request(app).get('/auth/me').set(bearer(res.body.token))).status).toBe(200);
    });

    it('AUTH-4 wrong password and unknown email give the same 401', async () => {
      await registered();
      const wrong = await request(app).post('/auth/login').send({ email: 'rina@example.com', password: 'wrong pass' });
      const unknown = await request(app).post('/auth/login').send({ email: 'who@example.com', password: 'correct horse' });
      const google = await request(app).post('/auth/login').send({ email: '', password: '' });
      for (const r of [wrong, unknown, google]) {
        expect(r.status).toBe(401);
        expect(r.body).toEqual({ error: BAD_LOGIN });
      }
    });

    it('AUTH-4 a Google-only account cannot log in with a password', async () => {
      await User.create({ name: 'Gina', email: 'gina@gmail.com', googleId: 'g', isGuest: false });
      const res = await request(app).post('/auth/login').send({ email: 'gina@gmail.com', password: 'anything at all' });
      expect(res.status).toBe(401);
      expect(res.body).toEqual({ error: BAD_LOGIN });
    });
  });

  describe('AUTH-5 google', () => {
    const post = (idToken: string, token?: string) => {
      const r = request(app).post('/auth/google');
      return (token ? r.set(bearer(token)) : r).send({ idToken });
    };

    it('AUTH-5 new user from a Google token', async () => {
      verifyMock.mockResolvedValue(googleId());
      const res = await post('good');
      expect(res.status).toBe(201);
      expect(res.body.user).toMatchObject({ name: 'Gina Rahman', email: 'gina@gmail.com', hasGoogle: true, isGuest: false });
      expect(verifyMock).toHaveBeenCalledWith('good', env.GOOGLE_CLIENT_IDS);
      // Same Google account again → same user.
      const again = await post('good');
      expect(again.status).toBe(200);
      expect(again.body.user.id).toBe(res.body.user.id);
    });

    it('AUTH-5 links to an existing user with the same verified email', async () => {
      const a = await registered('gina@gmail.com');
      verifyMock.mockResolvedValue(googleId());
      const res = await post('good');
      expect(res.status).toBe(200);
      expect(res.body.user).toMatchObject({ id: a.user.id, hasGoogle: true, hasPassword: true });
    });

    it('AUTH-5 an unverified email does not link; it makes a new user', async () => {
      const a = await registered('gina@gmail.com');
      verifyMock.mockResolvedValue(googleId({ email: null }));
      const res = await post('good');
      expect(res.status).toBe(201);
      expect(res.body.user.id).not.toBe(a.user.id);
      expect(res.body.user.email).toBeNull();
    });

    it('AUTH-5 upgrades the calling guest', async () => {
      const g = await newGuest('Tuhin');
      await User.updateOne({ _id: g.user.id }, { 'ratings.carrom': { rating: 1100, games: 0 }, coins: 7 });
      verifyMock.mockResolvedValue(googleId());
      const res = await post('good', g.token);
      expect(res.status).toBe(200);
      expect(res.body.user).toMatchObject({
        id: g.user.id, name: 'Tuhin', rating: 1100, coins: 7, isGuest: false, email: 'gina@gmail.com', hasGoogle: true,
      });
    });

    it('AUTH-5 bad token 401', async () => {
      verifyMock.mockRejectedValue(new Error('Wrong recipient'));
      const res = await post('forged');
      expect(res.status).toBe(401);
      expect(res.body).toEqual({ error: expect.any(String) });
      expect(await User.countDocuments({})).toBe(0);
    });

    it('AUTH-5 missing idToken 400; no client ids configured 503', async () => {
      expect((await request(app).post('/auth/google').send({})).status).toBe(400);
      const off = createApp({ ...env, GOOGLE_CLIENT_IDS: [] });
      const res = await request(off).post('/auth/google').send({ idToken: 'x' });
      expect(res.status).toBe(503);
      expect(res.body).toEqual({ error: GOOGLE_OFF });
      expect(verifyMock).not.toHaveBeenCalled();
    });

    it('AUTH-5 a Google name that is no valid player name becomes Player-1234', async () => {
      verifyMock.mockResolvedValue(googleId({ name: 'Al' }));
      expect((await post('good')).body.user.name).toMatch(/^Player-\d{4}$/);
    });
  });

  describe('AUTH-6 me', () => {
    it('AUTH-6 me/patch name and avatar', async () => {
      const { token } = await newGuest();
      const res = await request(app).patch('/auth/me').set(bearer(token)).send({ name: ' Rina ', avatar: 3 });
      expect(res.status).toBe(200);
      expect(res.body.user).toMatchObject({ name: 'Rina', avatar: 3 });
      expect((await request(app).get('/auth/me').set(bearer(token))).body.user).toMatchObject({ name: 'Rina', avatar: 3 });
    });

    it('AUTH-6 name rules: 3–20 characters, no control characters', async () => {
      const { token } = await newGuest();
      const patch = (body: object) => request(app).patch('/auth/me').set(bearer(token)).send(body);
      expect((await patch({ name: 'ab' })).status).toBe(400);
      expect((await patch({ name: 'x'.repeat(21) })).status).toBe(400);
      expect((await patch({ name: '   ab   ' })).status).toBe(400);
      expect((await patch({ name: 'Ri\u0000na' })).status).toBe(400);
      expect((await patch({ name: 'x'.repeat(20) })).status).toBe(200);
      expect((await patch({ name: 'রিনা আক্তার' })).status).toBe(200);
    });

    it('AUTH-6 bad avatar or unknown field 400', async () => {
      const { token } = await newGuest();
      const patch = (body: object) => request(app).patch('/auth/me').set(bearer(token)).send(body);
      expect((await patch({ avatar: 99 })).status).toBe(400);
      expect((await patch({ avatar: 1.5 })).status).toBe(400);
      expect((await patch({ rating: 3000 })).status).toBe(400);
    });

    it('AUTH-6 missing or bad token 401', async () => {
      const cases = [
        request(app).get('/auth/me'),
        request(app).get('/auth/me').set({ Authorization: 'Bearer nonsense' }),
        request(app).get('/auth/me').set(bearer(signToken('000000000000000000000000', 'w'.repeat(32)))),
        request(app).get('/auth/me').set(bearer(signToken('000000000000000000000000', SECRET))), // no such user
        request(app).get('/auth/me').set(bearer(signToken('not-an-id', SECRET))),
        request(app).patch('/auth/me').send({ name: 'Rina' }),
      ];
      for (const r of await Promise.all(cases)) {
        expect(r.status).toBe(401);
        expect(r.body).toEqual({ error: expect.any(String) });
      }
    });
  });

  describe('AUTH-7 rate limit', () => {
    it('AUTH-7 21st request in a minute gets 429', async () => {
      const limited = createApp(env);
      for (let i = 0; i < 20; i++) {
        const r = await request(limited).get('/auth/me');
        expect(r.status).toBe(401);
      }
      const r = await request(limited).post('/auth/guest').send({});
      expect(r.status).toBe(429);
      expect(r.body).toEqual({ error: RATE_LIMITED });
      // Other routes are not limited.
      expect((await request(limited).get('/health')).status).toBe(200);
    });
  });
});
