import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, inject, it } from 'vitest';
import type { FriendsResponse, PresenceResponse } from '@carrom/protocol';
import { createApp, type AppEnv } from '../app.js';
import { connectDb, disconnectDb } from '../connectDb.js';
import { Friendship } from '../models/friendship.model.js';
import { User } from '../models/user.model.js';
import { signToken } from '../utils/jwt.js';
import { memoryPresence } from '../utils/presence.js';

const SECRET = 'f'.repeat(32);
const env: AppEnv = { CORS_ORIGIN: [], NODE_ENV: 'test', JWT_SECRET: SECRET, GOOGLE_CLIENT_IDS: [] };
const app = createApp(env, { authRateLimit: 10_000, presence: memoryPresence() });

describe('ADDA-1 friends', () => {
  let rina = '';
  let sumi = '';
  const auth = (id: string) => `Bearer ${signToken(id, SECRET)}`;
  const friendsOf = async (id: string) => (await request(app).get('/friends').set('Authorization', auth(id))).body as FriendsResponse;
  const notices = async (id: string, game: string | null = null) =>
    ((await request(app).post('/presence').set('Authorization', auth(id)).send({ game })).body as PresenceResponse).notices;

  beforeAll(async () => {
    await connectDb(inject('mongoUri'));
    await Promise.all([User.syncIndexes(), Friendship.syncIndexes()]);
  });
  beforeEach(async () => {
    await Promise.all([User.deleteMany({}), Friendship.deleteMany({})]);
    rina = (await User.create({ name: 'Rina' })).id as string;
    sumi = (await User.create({ name: 'Sumi' })).id as string;
  });
  afterAll(async () => {
    await disconnectDb();
  });

  it('ADDA-1 friend request lifecycle: code → request → accept → online status → remove', async () => {
    const code = (await friendsOf(sumi)).code;
    expect(code).toMatch(/^[A-Z2-9]{8}$/);
    expect((await friendsOf(sumi)).code).toBe(code); // the code is kept

    const sent = await request(app).post('/friends/requests').set('Authorization', auth(rina)).send({ code: code.toLowerCase() });
    expect(sent.status).toBe(201);
    expect(sent.body).toEqual({ status: 'sent' });
    expect((await friendsOf(rina)).outgoing.map((u) => u.id)).toEqual([sumi]);
    expect((await friendsOf(sumi)).incoming.map((u) => u.name)).toEqual(['Rina']);
    // ADDA-6 an in-app notice, once.
    expect((await notices(sumi)).map((n) => n.kind)).toEqual(['friendRequest']);
    expect(await notices(sumi)).toEqual([]);
    // Asking again is a no-op.
    expect((await request(app).post('/friends/requests').set('Authorization', auth(rina)).send({ code })).status).toBe(200);

    expect((await request(app).post(`/friends/${rina}/accept`).set('Authorization', auth(sumi))).status).toBe(200);
    expect((await notices(rina, 'ludo')).map((n) => n.kind)).toEqual(['friendAccepted']);
    const s = await friendsOf(sumi);
    expect(s.friends).toEqual([{ id: rina, name: 'Rina', avatar: 0, presence: { state: 'game', game: 'ludo' } }]);
    expect(s.incoming).toEqual([]);
    await notices(rina, null);
    expect((await friendsOf(sumi)).friends[0]?.presence).toEqual({ state: 'menu' });
    expect((await friendsOf(rina)).friends[0]?.presence).toEqual({ state: 'menu' }); // Sumi beat above

    expect((await request(app).delete(`/friends/${sumi}`).set('Authorization', auth(rina))).status).toBe(200);
    expect((await friendsOf(sumi)).friends).toEqual([]);
  });

  it('ADDA-1 decline, request by user id, and asking back makes friends at once', async () => {
    await request(app).post('/friends/requests').set('Authorization', auth(rina)).send({ userId: sumi });
    expect((await request(app).post(`/friends/${rina}/decline`).set('Authorization', auth(sumi))).status).toBe(200);
    expect((await friendsOf(rina)).outgoing).toEqual([]);
    // Accepting a request that is gone.
    expect((await request(app).post(`/friends/${rina}/accept`).set('Authorization', auth(sumi))).status).toBe(404);

    await request(app).post('/friends/requests').set('Authorization', auth(rina)).send({ userId: sumi });
    const back = await request(app).post('/friends/requests').set('Authorization', auth(sumi)).send({ userId: rina });
    expect(back.body).toEqual({ status: 'friends' });
    expect((await friendsOf(rina)).friends.map((f) => f.id)).toEqual([sumi]);
  });

  it('ADDA-1 blocked user can\'t send requests; blocking ends a friendship', async () => {
    expect((await request(app).post('/me/block').set('Authorization', auth(sumi)).send({ userId: rina })).status).toBe(200);
    const res = await request(app).post('/friends/requests').set('Authorization', auth(rina)).send({ userId: sumi });
    expect(res.status).toBe(403);
    // Nor the blocker, while the block stands.
    expect((await request(app).post('/friends/requests').set('Authorization', auth(sumi)).send({ userId: rina })).status).toBe(403);
    expect(await Friendship.countDocuments()).toBe(0);
    expect((await friendsOf(sumi)).blocked).toEqual([{ id: rina, name: 'Rina', avatar: 0 }]);
    expect(await notices(sumi)).toEqual([]);

    await request(app).delete(`/me/block/${rina}`).set('Authorization', auth(sumi));
    await request(app).post('/friends/requests').set('Authorization', auth(rina)).send({ userId: sumi });
    await request(app).post(`/friends/${rina}/accept`).set('Authorization', auth(sumi));
    expect((await friendsOf(rina)).friends).toHaveLength(1);
    await request(app).post('/me/block').set('Authorization', auth(rina)).send({ userId: sumi });
    expect((await friendsOf(rina)).friends).toEqual([]);
    expect((await friendsOf(sumi)).friends).toEqual([]);
  });

  it('ADDA-1 bad requests: unknown code, own code, signed out', async () => {
    const post = (b: object) => request(app).post('/friends/requests').set('Authorization', auth(rina)).send(b);
    expect((await post({ code: 'ZZZZZZZZ' })).status).toBe(404);
    expect((await post({ code: 'nope' })).status).toBe(404);
    expect((await post({ userId: 'x' })).status).toBe(400);
    expect((await post({ code: (await friendsOf(rina)).code })).status).toBe(400);
    expect((await request(app).get('/friends')).status).toBe(401);
    expect((await request(app).post('/presence').send({ game: null })).status).toBe(401);
  });
});
