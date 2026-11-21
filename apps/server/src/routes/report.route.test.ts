import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, inject, it } from 'vitest';
import { createApp, type AppEnv } from '../app.js';
import { connectDb, disconnectDb } from '../connectDb.js';
import { Report } from '../models/report.model.js';
import { User } from '../models/user.model.js';
import { signToken } from '../utils/jwt.js';

const SECRET = 'p'.repeat(32);
const env: AppEnv = { CORS_ORIGIN: ['http://localhost:5173'], NODE_ENV: 'test', JWT_SECRET: SECRET, GOOGLE_CLIENT_IDS: [] };
const app = createApp(env, { authRateLimit: 10_000 });

describe('VOICE-6 reports and blocks', () => {
  let me = '';
  let them = '';
  let auth = '';
  beforeAll(async () => {
    await connectDb(inject('mongoUri'));
    await Promise.all([User.syncIndexes(), Report.syncIndexes()]);
  });
  beforeEach(async () => {
    await Promise.all([User.deleteMany({}), Report.deleteMany({})]);
    me = (await User.create({ name: 'Rina' })).id as string;
    them = (await User.create({ name: 'Troll' })).id as string;
    auth = `Bearer ${signToken(me, SECRET)}`;
  });
  afterAll(async () => {
    await disconnectDb();
  });

  it('VOICE-6 report stored with matchId; a repeat for the same match is a no-op', async () => {
    const body = { userId: them, matchId: 'room-abc', reason: 'abuse' };
    expect((await request(app).post('/reports').send(body)).status).toBe(401);
    expect((await request(app).post('/reports').set('Authorization', auth).send(body)).status).toBe(201);
    expect((await request(app).post('/reports').set('Authorization', auth).send(body)).status).toBe(200);
    const rows = await Report.find({}).lean();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ reporterId: me, userId: them, matchId: 'room-abc', reason: 'abuse' });
  });

  it('VOICE-6 bad reports are refused', async () => {
    const post = (b: object) => request(app).post('/reports').set('Authorization', auth).send(b);
    expect((await post({ userId: me, matchId: 'r', reason: 'abuse' })).status).toBe(400);
    expect((await post({ userId: them, matchId: 'r', reason: 'ugly' })).status).toBe(400);
    expect((await post({ userId: them, reason: 'abuse' })).status).toBe(400);
    expect((await post({ userId: '6650f0c2a1b2c3d4e5f60718', matchId: 'r', reason: 'abuse' })).status).toBe(404);
    expect(await Report.countDocuments()).toBe(0);
  });

  it('VOICE-6 block is stored on the account and shown in the user; unblock removes it', async () => {
    expect((await request(app).post('/me/block').send({ userId: them })).status).toBe(401);
    const res = await request(app).post('/me/block').set('Authorization', auth).send({ userId: them });
    expect(res.status).toBe(200);
    expect(res.body.user.blocked).toEqual([them]);
    await request(app).post('/me/block').set('Authorization', auth).send({ userId: them });
    expect((await User.findById(me))!.blocked).toEqual([them]);
    expect((await request(app).post('/me/block').set('Authorization', auth).send({ userId: me })).status).toBe(400);
    const me2 = await request(app).get('/auth/me').set('Authorization', auth);
    expect(me2.body.user.blocked).toEqual([them]);
    const un = await request(app).delete(`/me/block/${them}`).set('Authorization', auth);
    expect(un.status).toBe(200);
    expect(un.body.user.blocked).toEqual([]);
  });
});
