import request from 'supertest';
import { afterAll, afterEach, beforeAll, describe, expect, it, inject } from 'vitest';
import { createApp, type AppEnv } from '../app.js';
import { connectDb, disconnectDb } from '../connectDb.js';
import { Match } from '../models/match.model.js';
import { User } from '../models/user.model.js';
import { recordMatch } from '../rooms/matchResult.js';
import { signToken } from '../utils/jwt.js';

const SECRET = 'l'.repeat(32);
const env: AppEnv = { CORS_ORIGIN: ['http://localhost:5173'], NODE_ENV: 'test', JWT_SECRET: SECRET, GOOGLE_CLIENT_IDS: [] };
const app = createApp(env);
const bearer = (id: string) => ({ Authorization: `Bearer ${signToken(id, SECRET)}` });

/** A ranked player; `age` = days since the account was made (older = bigger). */
async function player(name: string, rating: number, age: number, rankedGames = 1) {
  const createdAt = new Date(Date.UTC(2026, 0, 1) - age * 86_400_000);
  const u = await User.create({ name, rating, rankedGames, createdAt });
  return u.id as string;
}

describe('leaderboard and history routes', () => {
  beforeAll(async () => {
    await connectDb(inject('mongoUri'));
  });
  afterEach(async () => {
    await Promise.all([User.deleteMany({}), Match.deleteMany({})]);
  });
  afterAll(disconnectDb);

  it('RANK-6 leaderboard: by rating, ties by older account; unranked players left out', async () => {
    await player('Mid', 1100, 1);
    const old = await player('OldTie', 1200, 30);
    await player('NewTie', 1200, 2);
    await player('Top', 1400, 5);
    await player('Never', 2000, 50, 0);
    const res = await request(app).get('/leaderboard');
    expect(res.status).toBe(200);
    expect(res.body.players.map((p: { name: string; rank: number }) => `${p.rank}.${p.name}`))
      .toEqual(['1.Top', '2.OldTie', '3.NewTie', '4.Mid']);
    expect(res.body.players[1]).toEqual({ rank: 2, id: old, name: 'OldTie', avatar: 0, rating: 1200 });
    expect(res.body.me).toBeNull();
  });

  it('RANK-6 limit caps the list; bad limits are refused', async () => {
    for (let i = 0; i < 5; i++) await player(`P${i}x`, 1000 + i, i);
    const res = await request(app).get('/leaderboard?limit=3');
    expect(res.body.players.map((p: { name: string }) => p.name)).toEqual(['P4x', 'P3x', 'P2x']);
    expect((await request(app).get('/leaderboard?limit=500')).body.players).toHaveLength(5);
    expect((await request(app).get('/leaderboard?limit=0')).status).toBe(400);
    expect((await request(app).get('/leaderboard?limit=abc')).status).toBe(400);
  });

  it('RANK-6 the caller gets their rank, also below the limit', async () => {
    for (let i = 0; i < 4; i++) await player(`Hi${i}x`, 1500 + i, i);
    const tied = await player('TiedOld', 1000, 20);
    const me = await player('Mine', 1000, 3);
    const res = await request(app).get('/leaderboard?limit=2').set(bearer(me));
    expect(res.body.players).toHaveLength(2);
    expect(res.body.me).toMatchObject({ rank: 6, id: me, rating: 1000 });
    const top = await request(app).get('/leaderboard').set(bearer(tied));
    expect(top.body.me).toMatchObject({ rank: 5, name: 'TiedOld' });
    // Signed in but never played ranked: no row.
    const fresh = await player('Fresh', 1000, 0, 0);
    expect((await request(app).get('/leaderboard').set(bearer(fresh))).body.me).toBeNull();
  });

  it('RANK-6 /matches/me lists my games newest first, with the limit', async () => {
    const a = await player('Anik', 1000, 1, 0);
    const b = await player('Bina', 1000, 1, 0);
    const c = await player('Chayan', 1000, 1, 0);
    // m1: a 1016, b 984. m2: b beats c from 984 → c 983. m3: a (1016) beats c (983) → +14.48 → 1030.
    const game = (id: string, x: string, y: string) => recordMatch({
      matchId: id, ranked: true, format: '1v1', winner: 'A', boards: 1, abandoned: false,
      players: [{ userId: x, name: 'X', seat: 0 }, { userId: y, name: 'Y', seat: 2 }],
    });
    await game('m1', a, b);
    await game('m2', b, c);
    await game('m3', a, c);
    expect((await request(app).get('/matches/me')).status).toBe(401);
    const res = await request(app).get('/matches/me').set(bearer(a));
    expect(res.status).toBe(200);
    expect(res.body.matches).toHaveLength(2);
    const [newest] = res.body.matches;
    expect(newest.ranked).toBe(true);
    expect(newest.players.map((p: { userId: string }) => p.userId)).toEqual([a, c]);
    expect(newest.players[0]).toMatchObject({ seat: 0, team: 'A', ratingBefore: 1016, ratingAfter: 1030 });
    expect((await request(app).get('/matches/me?limit=1').set(bearer(a))).body.matches).toHaveLength(1);
  });
});
