import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, inject, it } from 'vitest';
import { createApp, type AppEnv } from '../app.js';
import { connectDb, disconnectDb } from '../connectDb.js';
import { CANCELLED_PURCHASE, IAP_OFF, INVALID_PURCHASE, NOT_YOUR_PURCHASE } from '../controllers/iap.controller.js';
import { Purchase } from '../models/purchase.model.js';
import { User } from '../models/user.model.js';
import { signToken } from '../utils/jwt.js';
import type { PlayBilling, ProductPurchase } from '../utils/playBilling.js';

const SECRET = 'a'.repeat(32);
const env: AppEnv = { CORS_ORIGIN: ['http://localhost:5173'], NODE_ENV: 'test', JWT_SECRET: SECRET, GOOGLE_CLIENT_IDS: [] };

/** A stand-in for Google Play: tokens → state, per product. Records consume calls. */
class FakePlay {
  purchases = new Map<string, ProductPurchase & { productId: string }>();
  consumed: string[] = [];
  failConsume = false;

  add(token: string, productId: string, over: Partial<ProductPurchase> = {}): void {
    this.purchases.set(token, {
      productId, purchaseState: 0, consumptionState: 0, orderId: `GPA.${token}`, accountId: null, ...over,
    });
  }

  billing(): PlayBilling {
    return {
      getProduct: async (productId, token) => {
        const p = this.purchases.get(token);
        if (!p || p.productId !== productId) return null;
        return { purchaseState: p.purchaseState, consumptionState: p.consumptionState, orderId: p.orderId, accountId: p.accountId };
      },
      consume: async (productId, token) => {
        if (this.failConsume) throw new Error('Play is down');
        this.consumed.push(token);
        const p = this.purchases.get(token);
        if (p && p.productId === productId) p.consumptionState = 1;
      },
    };
  }
}

let play = new FakePlay();
// `play` is replaced per test; the app reads whichever is current.
const app = createApp(env, {
  authRateLimit: 10_000,
  playBilling: {
    getProduct: (id, t) => play.billing().getProduct(id, t),
    consume: (id, t) => play.billing().consume(id, t),
  },
});

const coinsOf = async (id: string) => (await User.findById(id))!.coins;
const bearer = (id: string) => ({ Authorization: `Bearer ${signToken(id, SECRET)}` });
const verify = (userId: string, productId: string, purchaseToken: string) =>
  request(app).post('/iap/verify').set(bearer(userId)).send({ productId, purchaseToken });

describe('IAP-3 /iap/verify', () => {
  let userId = '';
  beforeAll(async () => {
    await connectDb(inject('mongoUri'));
    await Promise.all([User.syncIndexes(), Purchase.syncIndexes()]);
  });
  beforeEach(async () => {
    await Promise.all([User.deleteMany({}), Purchase.deleteMany({})]);
    play = new FakePlay();
    userId = (await User.create({ name: 'Rina' })).id as string;
  });
  afterAll(async () => {
    await disconnectDb();
  });

  it('IAP-3 verified purchase credits once and is consumed', async () => {
    play.add('t1', 'coins_1200', { accountId: userId });
    const res = await verify(userId, 'coins_1200', 't1');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: 'credited', credited: 1200, user: { coins: 1200 } });
    expect(await coinsOf(userId)).toBe(1200);
    expect(play.consumed).toEqual(['t1']);
    const row = await Purchase.findOne({ purchaseToken: 't1' }).lean();
    expect(row).toMatchObject({ userId, productId: 'coins_1200', orderId: 'GPA.t1', coins: 1200, status: 'credited' });
    expect(row!.createdAt).toBeInstanceOf(Date);
  });

  it('IAP-3 same token twice credits once (also in parallel)', async () => {
    play.add('t2', 'coins_500');
    const all = await Promise.all([1, 2, 3].map(() => verify(userId, 'coins_500', 't2')));
    expect(all.map((r) => r.status)).toEqual([200, 200, 200]);
    expect(all.map((r) => r.body.credited as number).sort((a, b) => b - a)).toEqual([500, 0, 0]);
    const again = await verify(userId, 'coins_500', 't2');
    expect(again.body).toMatchObject({ status: 'credited', credited: 0 });
    expect(await coinsOf(userId)).toBe(500);
    expect(await Purchase.countDocuments()).toBe(1);
  });

  it('IAP-3 invalid token rejected', async () => {
    const res = await verify(userId, 'coins_500', 'nope');
    expect(res.status).toBe(400);
    expect(res.body.error).toBe(INVALID_PURCHASE);
    expect(await coinsOf(userId)).toBe(0);
    expect(await Purchase.countDocuments()).toBe(0);
  });

  it('IAP-3 refunded purchase rejected', async () => {
    play.add('t3', 'coins_2600', { purchaseState: 1 });
    const res = await verify(userId, 'coins_2600', 't3');
    expect(res.status).toBe(400);
    expect(res.body.error).toBe(CANCELLED_PURCHASE);
    expect(await coinsOf(userId)).toBe(0);
  });

  it('IAP-3 wrong product rejected (token for another pack, unknown product id)', async () => {
    play.add('t4', 'coins_500');
    expect((await verify(userId, 'coins_2600', 't4')).body.error).toBe(INVALID_PURCHASE);
    expect((await verify(userId, 'coins_999999', 't4')).status).toBe(400);
    expect(await coinsOf(userId)).toBe(0);
  });

  it('IAP-3 token bought for or claimed by another account rejected', async () => {
    const otherId = (await User.create({ name: 'Mitu' })).id as string;
    play.add('t5', 'coins_500', { accountId: otherId });
    expect((await verify(userId, 'coins_500', 't5')).status).toBe(403);
    play.add('t6', 'coins_500');
    expect((await verify(otherId, 'coins_500', 't6')).status).toBe(200);
    const stolen = await verify(userId, 'coins_500', 't6');
    expect(stolen.status).toBe(409);
    expect(stolen.body.error).toBe(NOT_YOUR_PURCHASE);
    expect(await coinsOf(userId)).toBe(0);
    expect(await coinsOf(otherId)).toBe(500);
  });

  it('IAP-3 a failed consume still credits; the retry consumes without paying again', async () => {
    play.add('t7', 'coins_500');
    play.failConsume = true;
    expect((await verify(userId, 'coins_500', 't7')).body.credited).toBe(500);
    expect(play.consumed).toEqual([]);
    play.failConsume = false;
    expect((await verify(userId, 'coins_500', 't7')).body.credited).toBe(0);
    expect(play.consumed).toEqual(['t7']);
    expect(await coinsOf(userId)).toBe(500);
  });

  it('IAP-3 needs sign-in; bad body 400', async () => {
    expect((await request(app).post('/iap/verify').send({ productId: 'coins_500', purchaseToken: 'x' })).status).toBe(401);
    expect((await request(app).post('/iap/verify').set(bearer(userId)).send({ productId: 'coins_500' })).status).toBe(400);
  });

  it('IAP-3 off without the PLAY_ env keys → 503', async () => {
    const off = createApp(env, { authRateLimit: 10_000, playBilling: null });
    const res = await request(off).post('/iap/verify').set(bearer(userId)).send({ productId: 'coins_500', purchaseToken: 'x' });
    expect(res.status).toBe(503);
    expect(res.body.error).toBe(IAP_OFF);
    expect((await request(createApp(env)).post('/iap/verify').set(bearer(userId)).send({})).status).toBe(503);
  });

  it('IAP-4 pending → later completed credits once', async () => {
    play.add('t8', 'coins_2600', { purchaseState: 2, orderId: null });
    const pending = await verify(userId, 'coins_2600', 't8');
    expect(pending.status).toBe(202);
    expect(pending.body).toMatchObject({ status: 'pending', credited: 0 });
    expect(await coinsOf(userId)).toBe(0);
    expect(play.consumed).toEqual([]);
    expect(await Purchase.findOne({ purchaseToken: 't8' }).lean()).toMatchObject({ status: 'pending', coins: 2600 });

    // Still pending on the next start: nothing changes.
    expect((await verify(userId, 'coins_2600', 't8')).status).toBe(202);

    play.add('t8', 'coins_2600', { purchaseState: 0, orderId: 'GPA.late' });
    const done = await Promise.all([1, 2].map(() => verify(userId, 'coins_2600', 't8')));
    expect(done.map((r) => r.body.credited as number).sort((a, b) => b - a)).toEqual([2600, 0]);
    expect(await coinsOf(userId)).toBe(2600);
    expect(await Purchase.findOne({ purchaseToken: 't8' }).lean()).toMatchObject({ status: 'credited', orderId: 'GPA.late' });
  });
});
