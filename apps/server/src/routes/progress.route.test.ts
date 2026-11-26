import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, inject, it } from 'vitest';
import { missionTiers, PROGRESS, type Mission } from '@carrom/protocol';
import { GAME_IDS } from '@hub/game-kit';
import { createApp, type AppEnv } from '../app.js';
import { connectDb, disconnectDb } from '../connectDb.js';
import { User } from '../models/user.model.js';
import { dayKey, ECONOMY } from '../utils/economyConfig.js';
import { signToken } from '../utils/jwt.js';
import { MISSION_CLAIMED, MISSION_NOT_DONE, MISSION_NOT_FOUND, NO_SWAPS } from '../utils/progress.js';

const SECRET = 's'.repeat(32);
const env: AppEnv = {
  CORS_ORIGIN: ['http://localhost:5173'], NODE_ENV: 'test', JWT_SECRET: SECRET, GOOGLE_CLIENT_IDS: [],
};
const app = createApp(env, { authRateLimit: 10_000 });
const tiers = missionTiers(GAME_IDS);
const byId = new Map(tiers.flat().map((m) => [m.id, m]));

async function player(over: Record<string, unknown> = {}) {
  const u = await User.create({ name: 'Rina', ...over });
  return { id: u.id as string, auth: { Authorization: `Bearer ${signToken(u.id as string, SECRET)}` } };
}

async function setMissions(id: string, list: (Mission & { progress?: number })[]) {
  await User.updateOne({ _id: id }, {
    $set: { missions: { day: dayKey(new Date()), swaps: 0, list: list.map((m) => ({ progress: 0, seen: [], claimed: false, ...m })) } },
  });
}

describe('progress routes', () => {
  beforeAll(async () => {
    await connectDb(inject('mongoUri'));
  });
  beforeEach(async () => {
    await User.deleteMany({});
  });
  afterAll(async () => {
    await disconnectDb();
  });

  it('PRG-7 GET /me/progress: level, streak, 3 missions one per tier, swaps left; 401 without a token', async () => {
    const p = await player();
    const res = await request(app).get('/me/progress').set(p.auth);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      day: dayKey(new Date()), xp: 0, level: 1, levelXp: 0, levelNeed: 100,
      streak: { count: 0, day: 1, claimedToday: false }, swapsLeft: PROGRESS.swapsPerDay,
      user: { id: p.id, xp: 0, level: 1 },
    });
    expect(res.body.missions).toHaveLength(3);
    res.body.missions.forEach((m: Mission & { progress: number; claimed: boolean }, i: number) => {
      expect(tiers[i]!.map((x) => x.id)).toContain(m.id);
      expect(m).toMatchObject({ progress: 0, claimed: false });
    });
    expect((await request(app).get('/me/progress')).status).toBe(401);
  });

  it('PRG-7 after the daily bonus the streak reads claimed', async () => {
    const p = await player();
    const bonus = await request(app).post('/me/daily-bonus').set(p.auth);
    expect(bonus.body).toMatchObject({ reward: ECONOMY.dailyBonus, streak: 1 });
    const res = await request(app).get('/me/progress').set(p.auth);
    expect(res.body.streak).toEqual({ count: 1, day: 1, claimedToday: true });
  });

  it('PRG-4 claim: not complete 400; complete → coins + XP; again 409; bad index 404', async () => {
    const p = await player();
    const win = byId.get('win-any')!;
    await setMissions(p.id, [byId.get('play-any')!, { ...win, progress: win.target }, byId.get('online-any')!]);
    const early = await request(app).post('/me/missions/0/claim').set(p.auth);
    expect([early.status, early.body.error]).toEqual([400, MISSION_NOT_DONE]);
    const ok = await request(app).post('/me/missions/1/claim').set(p.auth);
    expect(ok.status).toBe(200);
    expect(ok.body.reward).toEqual({ coins: win.coins, xp: win.xp });
    expect(ok.body.missions[1]).toMatchObject({ id: 'win-any', claimed: true, progress: win.target });
    expect(ok.body.user).toMatchObject({ coins: win.coins, xp: win.xp });
    const again = await request(app).post('/me/missions/1/claim').set(p.auth);
    expect([again.status, again.body.error]).toEqual([409, MISSION_CLAIMED]);
    for (const bad of ['7', 'x', '-1']) {
      const r = await request(app).post(`/me/missions/${bad}/claim`).set(p.auth);
      expect([r.status, r.body.error]).toEqual([404, MISSION_NOT_FOUND]);
    }
  });

  it('PRG-4 parallel claims credit once; a variety mission needs that many distinct games', async () => {
    const p = await player();
    const variety = byId.get('variety-any')!;
    await setMissions(p.id, [{ ...variety, seen: ['ludo'] } as Mission, { ...variety, id: 'variety-2', seen: ['ludo', 'carrom'] } as Mission]);
    expect((await request(app).post('/me/missions/0/claim').set(p.auth)).status).toBe(400);
    const all = await Promise.all([1, 2, 3].map(() => request(app).post('/me/missions/1/claim').set(p.auth)));
    expect(all.map((r) => r.status).sort()).toEqual([200, 409, 409]);
    expect((await User.findById(p.id))!.coins).toBe(variety.coins);
  });

  it('PRG-1 a claim that reaches a level pays the level-up coins too', async () => {
    const p = await player({ xp: 90 });
    const win = byId.get('win-any')!;
    await setMissions(p.id, [{ ...win, progress: win.target }]);
    const ok = await request(app).post('/me/missions/0/claim').set(p.auth);
    expect(ok.body.reward).toEqual({ coins: win.coins, xp: win.xp, level: 2, levelCoins: PROGRESS.levelUpCoins });
    expect(ok.body).toMatchObject({ level: 2, user: { level: 2, coins: win.coins + PROGRESS.levelUpCoins } });
  });

  it('PRG-5 swap: a same-tier mission not in the list; a second swap 409; claimed 409', async () => {
    const p = await player();
    const first = (await request(app).get('/me/progress').set(p.auth)).body.missions as Mission[];
    const res = await request(app).post('/me/missions/0/swap').set(p.auth);
    expect(res.status).toBe(200);
    const next = res.body.missions[0] as Mission;
    expect(first.map((m) => m.id)).not.toContain(next.id);
    expect(tiers[0]!.map((m) => m.id)).toContain(next.id);
    expect(res.body.swapsLeft).toBe(0);
    const again = await request(app).post('/me/missions/1/swap').set(p.auth);
    expect([again.status, again.body.error]).toEqual([409, NO_SWAPS]);

    const q = await player();
    await setMissions(q.id, [{ ...byId.get('play-any')!, claimed: true } as Mission]);
    const claimed = await request(app).post('/me/missions/0/swap').set(q.auth);
    expect([claimed.status, claimed.body.error]).toEqual([409, MISSION_CLAIMED]);
  });

  it('PRG-7 bot reward takes the game id and answers with XP; unknown game 400', async () => {
    const p = await player();
    await setMissions(p.id, [byId.get('play-nodipar')!]);
    const res = await request(app).post('/me/bot-reward').set(p.auth).send({ won: true, game: 'nodipar' });
    expect(res.body).toMatchObject({ reward: ECONOMY.win, xp: PROGRESS.gameXp.win, user: { xp: PROGRESS.gameXp.win, level: 1 } });
    expect(res.body.level).toBeUndefined();
    const progress = await request(app).get('/me/progress').set(p.auth);
    expect(progress.body.missions[0]).toMatchObject({ id: 'play-nodipar', progress: 1 });
    expect((await request(app).post('/me/bot-reward').set(p.auth).send({ won: true, game: 'chess' })).status).toBe(400);
  });

  it('PRG-7 mission routes need sign-in', async () => {
    expect((await request(app).post('/me/missions/0/claim')).status).toBe(401);
    expect((await request(app).post('/me/missions/0/swap')).status).toBe(401);
  });
});
