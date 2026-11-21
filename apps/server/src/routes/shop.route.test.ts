import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, inject, it } from 'vitest';
import { createApp, type AppEnv } from '../app.js';
import { connectDb, disconnectDb } from '../connectDb.js';
import { ALREADY_OWNED, NOT_ENOUGH_COINS, NOT_OWNED, UNKNOWN_ITEM } from '../controllers/shop.controller.js';
import { User } from '../models/user.model.js';
import { ECONOMY } from '../utils/economyConfig.js';
import { signToken } from '../utils/jwt.js';

const SECRET = 's'.repeat(32);
const env: AppEnv = {
  CORS_ORIGIN: ['http://localhost:5173'], NODE_ENV: 'test', JWT_SECRET: SECRET, GOOGLE_CLIENT_IDS: [],
};
const app = createApp(env, { authRateLimit: 10_000 });

async function player(coins = 0, owned: string[] = [], equipped: string[] = []) {
  const u = await User.create({ name: 'Rina', coins, cosmetics: { owned, equipped } });
  return { id: u.id as string, auth: { Authorization: `Bearer ${signToken(u.id as string, SECRET)}` } };
}

const coinsOf = async (id: string) => (await User.findById(id))!.coins;

describe('shop and wallet routes', () => {
  beforeAll(async () => {
    await connectDb(inject('mongoUri'));
    await User.syncIndexes();
  });
  beforeEach(async () => {
    await User.deleteMany({});
  });
  afterAll(async () => {
    await disconnectDb();
  });

  describe('COS-3 buy', () => {
    it('COS-3 buy ok: coins go down by the price, the item is owned', async () => {
      const p = await player(500);
      const res = await request(app).post('/shop/buy').set(p.auth).send({ itemId: 'gold-striker' });
      expect(res.status).toBe(200);
      expect(res.body.user.coins).toBe(100);
      expect(res.body.user.cosmetics.owned).toContain('gold-striker');
    });

    it('COS-3 not enough coins 400', async () => {
      const p = await player(399);
      const res = await request(app).post('/shop/buy').set(p.auth).send({ itemId: 'gold-striker' });
      expect(res.status).toBe(400);
      expect(res.body.error).toBe(NOT_ENOUGH_COINS);
      expect(await coinsOf(p.id)).toBe(399);
    });

    it('COS-3 already owned 409 (bought items and defaults)', async () => {
      const p = await player(1000, ['gold-striker']);
      const again = await request(app).post('/shop/buy').set(p.auth).send({ itemId: 'gold-striker' });
      expect(again.status).toBe(409);
      expect(again.body.error).toBe(ALREADY_OWNED);
      const free = await request(app).post('/shop/buy').set(p.auth).send({ itemId: 'classic-board' });
      expect(free.status).toBe(409);
      expect(await coinsOf(p.id)).toBe(1000);
    });

    it('COS-3 concurrent double buy charges once', async () => {
      const p = await player(1000);
      const tries = await Promise.all(Array.from({ length: 5 }, () =>
        request(app).post('/shop/buy').set(p.auth).send({ itemId: 'gold-striker' })));
      expect(tries.filter((r) => r.status === 200)).toHaveLength(1);
      expect(tries.filter((r) => r.status === 409)).toHaveLength(4);
      expect(await coinsOf(p.id)).toBe(600);
      expect((await User.findById(p.id))!.cosmetics!.owned).toEqual(['gold-striker']);
    });

    it('COS-3 unknown item 400; no token 401', async () => {
      const p = await player(1000);
      const res = await request(app).post('/shop/buy').set(p.auth).send({ itemId: 'laser-striker' });
      expect(res.status).toBe(400);
      expect(res.body.error).toBe(UNKNOWN_ITEM);
      expect((await request(app).post('/shop/buy').send({ itemId: 'gold-striker' })).status).toBe(401);
    });
  });

  describe('COS-4 equip', () => {
    it('COS-4 equip owned ok (bought and default items)', async () => {
      const p = await player(0, ['gold-striker', 'jade-coins']);
      const res = await request(app).patch('/me/equip').set(p.auth).send({ striker: 'gold-striker', coins: 'jade-coins' });
      expect(res.status).toBe(200);
      expect(res.body.user.cosmetics.equipped.carrom).toEqual({ striker: 'gold-striker', coins: 'jade-coins', board: 'classic-board' });
      const back = await request(app).patch('/me/equip').set(p.auth).send({ striker: 'classic-striker' });
      expect(back.body.user.cosmetics.equipped.carrom).toEqual({ striker: 'classic-striker', coins: 'jade-coins', board: 'classic-board' });
    });

    it('COS-4 not owned 403, nothing changes', async () => {
      const p = await player(0, ['jade-coins']);
      const res = await request(app).patch('/me/equip').set(p.auth).send({ coins: 'jade-coins', board: 'royal-board' });
      expect(res.status).toBe(403);
      expect(res.body.error).toBe(NOT_OWNED);
      expect((await User.findById(p.id))!.cosmetics!.equipped).toEqual([]);
    });

    it('COS-4 an item in the wrong slot or unknown 400; extra keys 400', async () => {
      const p = await player(0, ['jade-coins']);
      expect((await request(app).patch('/me/equip').set(p.auth).send({ striker: 'jade-coins' })).status).toBe(400);
      expect((await request(app).patch('/me/equip').set(p.auth).send({ board: 'nope' })).status).toBe(400);
      expect((await request(app).patch('/me/equip').set(p.auth).send({ hat: 'x' })).status).toBe(400);
      // HAPP-5 a slot of another game, an item of another game, an unknown game.
      expect((await request(app).patch('/me/equip').set(p.auth).send({ game: 'ludo', coins: 'jade-coins' })).status).toBe(400);
      expect((await request(app).patch('/me/equip').set(p.auth).send({ game: 'ludo', board: 'classic-board' })).status).toBe(400);
      expect((await request(app).patch('/me/equip').set(p.auth).send({ game: 'chess', board: 'classic-board' })).status).toBe(400);
    });

    it('HAPP-5 old equipped id list resolves to the carrom slots; equipping a ludo item does not touch carrom', async () => {
      const p = await player(0, ['gold-striker', 'teak-board'], ['gold-striker', 'teak-board']);
      const me = await request(app).get('/auth/me').set(p.auth);
      expect(me.body.user.cosmetics.equipped.carrom).toEqual({ striker: 'gold-striker', coins: 'classic-coins', board: 'teak-board' });
      const res = await request(app).patch('/me/equip').set(p.auth).send({ game: 'ludo', board: 'classic-ludo-board' });
      expect(res.status).toBe(200);
      expect(res.body.user.cosmetics.equipped.carrom).toEqual(me.body.user.cosmetics.equipped.carrom);
      expect(res.body.user.cosmetics.equipped.ludo).toEqual({ tokens: 'classic-tokens', board: 'classic-ludo-board', dice: 'classic-dice' });
      // And carrom equips leave ludo alone.
      const back = await request(app).patch('/me/equip').set(p.auth).send({ board: 'classic-board' });
      expect(back.body.user.cosmetics.equipped.ludo).toEqual(res.body.user.cosmetics.equipped.ludo);
      expect(back.body.user.cosmetics.equipped.carrom.striker).toBe('gold-striker');
    });
  });

  describe('COS-2 wallet', () => {
    it('COS-2 daily bonus once per day', async () => {
      const p = await player(0);
      const first = await request(app).post('/me/daily-bonus').set(p.auth);
      expect(first.status).toBe(200);
      expect(first.body).toMatchObject({ reward: ECONOMY.dailyBonus, user: { coins: ECONOMY.dailyBonus } });
      const parallel = await Promise.all([1, 2, 3].map(() => request(app).post('/me/daily-bonus').set(p.auth)));
      expect(parallel.map((r) => r.body.reward)).toEqual([0, 0, 0]);
      expect(await coinsOf(p.id)).toBe(ECONOMY.dailyBonus);
      // The next day it is given again.
      await User.updateOne({ _id: p.id }, { dailyBonusDay: '2000-01-01' });
      expect((await request(app).post('/me/daily-bonus').set(p.auth)).body.reward).toBe(ECONOMY.dailyBonus);
    });

    it('COS-2 Vs-bot rewards per result: win 30, loss 10', async () => {
      const p = await player(0);
      const win = await request(app).post('/me/bot-reward').set(p.auth).send({ won: true });
      expect(win.body).toMatchObject({ reward: ECONOMY.win, user: { coins: 30 } });
      const loss = await request(app).post('/me/bot-reward').set(p.auth).send({ won: false });
      expect(loss.body).toMatchObject({ reward: ECONOMY.loss, user: { coins: 40 } });
      expect((await request(app).post('/me/bot-reward').set(p.auth).send({})).status).toBe(400);
    });

    it('COS-2 bot cap 5/day, also for parallel reports; a new day resets it', async () => {
      const p = await player(0);
      const tries = await Promise.all(Array.from({ length: 8 }, () =>
        request(app).post('/me/bot-reward').set(p.auth).send({ won: true })));
      expect(tries.filter((r) => r.body.reward === ECONOMY.win)).toHaveLength(ECONOMY.botGamesPerDay);
      expect(await coinsOf(p.id)).toBe(ECONOMY.win * ECONOMY.botGamesPerDay);
      await User.updateOne({ _id: p.id }, { botRewardDay: '2000-01-01' });
      expect((await request(app).post('/me/bot-reward').set(p.auth).send({ won: false })).body.reward).toBe(ECONOMY.loss);
    });

    it('COS-2 wallet routes need sign-in', async () => {
      expect((await request(app).post('/me/daily-bonus')).status).toBe(401);
      expect((await request(app).post('/me/bot-reward').send({ won: true })).status).toBe(401);
    });
  });
});
