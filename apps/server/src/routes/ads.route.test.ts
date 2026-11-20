import { generateKeyPairSync, sign } from 'node:crypto';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, inject, it, vi } from 'vitest';
import { createApp, type AppEnv } from '../app.js';
import { connectDb, disconnectDb } from '../connectDb.js';
import { AdReward } from '../models/adReward.model.js';
import { User } from '../models/user.model.js';
import { googleKeys, splitSigned, type KeySource } from '../utils/admobSsv.js';
import { ADS_CONFIG } from '../utils/adsConfig.js';
import { signToken } from '../utils/jwt.js';

const SECRET = 'a'.repeat(32);
const env: AppEnv = { CORS_ORIGIN: ['http://localhost:5173'], NODE_ENV: 'test', JWT_SECRET: SECRET, GOOGLE_CLIENT_IDS: [] };

// A stand-in for Google's signing key: P-256 ECDSA, like AdMob's.
const KEY_ID = '3335741209';
const pair = generateKeyPairSync('ec', { namedCurve: 'P-256' });
const pem = pair.publicKey.export({ type: 'spki', format: 'pem' }).toString();
const keys = vi.fn<KeySource>(async () => [{ keyId: KEY_ID, pem }]);
const app = createApp(env, { authRateLimit: 10_000, ssvKeys: keys });

let tx = 0;
/** A callback query string the way AdMob builds it: reward params, then signature, then key_id. */
function ssvQuery(userId: string, over: { transactionId?: string; keyId?: string; tamper?: boolean } = {}): string {
  const transactionId = over.transactionId ?? `tx-${++tx}`;
  const message = new URLSearchParams({
    ad_network: '5450213213286189855', ad_unit: '1234567890', reward_amount: '25', reward_item: 'coins',
    timestamp: '1763600000000', transaction_id: transactionId, user_id: userId,
  }).toString();
  const signature = sign('sha256', Buffer.from(message), pair.privateKey).toString('base64url');
  const signed = over.tamper ? message.replace('reward_amount=25', 'reward_amount=9999') : message;
  return `${signed}&signature=${signature}&key_id=${over.keyId ?? KEY_ID}`;
}

const coinsOf = async (id: string) => (await User.findById(id))!.coins;

describe('AD-3 rewarded ads', () => {
  let userId = '';
  beforeAll(async () => {
    await connectDb(inject('mongoUri'));
    await Promise.all([User.syncIndexes(), AdReward.syncIndexes()]);
  });
  beforeEach(async () => {
    await Promise.all([User.deleteMany({}), AdReward.deleteMany({})]);
    userId = (await User.create({ name: 'Rina' })).id as string;
  });
  afterAll(async () => {
    await disconnectDb();
  });

  it('AD-3 SSV: valid signature credits once', async () => {
    const res = await request(app).get(`/ads/ssv?${ssvQuery(userId)}`);
    expect(res.status).toBe(200);
    expect(res.body.credited).toBe(ADS_CONFIG.rewardedCoins);
    expect(await coinsOf(userId)).toBe(25);
    expect(await AdReward.countDocuments({ userId, coins: 25 })).toBe(1);
  });

  it('AD-3 SSV: replay ignored (same transaction id, also in parallel)', async () => {
    const q = ssvQuery(userId);
    const all = await Promise.all([1, 2, 3].map(() => request(app).get(`/ads/ssv?${q}`)));
    expect(all.map((r) => r.status)).toEqual([200, 200, 200]);
    expect(all.filter((r) => r.body.credited === 25)).toHaveLength(1);
    expect((await request(app).get(`/ads/ssv?${q}`)).body).toEqual({ credited: 0, replay: true });
    expect(await coinsOf(userId)).toBe(25);
  });

  it('AD-3 SSV: bad signature 400 (tampered, unknown key, missing signature)', async () => {
    expect((await request(app).get(`/ads/ssv?${ssvQuery(userId, { tamper: true })}`)).status).toBe(400);
    expect((await request(app).get(`/ads/ssv?${ssvQuery(userId, { keyId: '42' })}`)).status).toBe(400);
    expect((await request(app).get(`/ads/ssv?user_id=${userId}&transaction_id=x`)).status).toBe(400);
    expect(await coinsOf(userId)).toBe(0);
    expect(await AdReward.countDocuments()).toBe(0);
  });

  it('AD-3 SSV: 6th reward in a day not credited', async () => {
    for (let i = 0; i < ADS_CONFIG.rewardedPerDay; i++) {
      expect((await request(app).get(`/ads/ssv?${ssvQuery(userId)}`)).body.credited).toBe(25);
    }
    const sixth = await request(app).get(`/ads/ssv?${ssvQuery(userId)}`);
    expect(sixth.status).toBe(200);
    expect(sixth.body.credited).toBe(0);
    expect(await coinsOf(userId)).toBe(25 * ADS_CONFIG.rewardedPerDay);
    // A new day pays again.
    await User.updateOne({ _id: userId }, { adRewardDay: '2000-01-01' });
    expect((await request(app).get(`/ads/ssv?${ssvQuery(userId)}`)).body.credited).toBe(25);
  });

  it('AD-3 SSV: an unknown user is acknowledged but nothing is credited', async () => {
    const res = await request(app).get(`/ads/ssv?${ssvQuery('not-a-user')}`);
    expect(res.status).toBe(200);
    expect(res.body.credited).toBe(0);
  });

  it('AD-3 /ads/status: rewarded ads left today; needs sign-in', async () => {
    const auth = { Authorization: `Bearer ${signToken(userId, SECRET)}` };
    expect((await request(app).get('/ads/status').set(auth)).body).toEqual({ rewardedLeft: 5, rewardedCoins: 25 });
    await request(app).get(`/ads/ssv?${ssvQuery(userId)}`);
    expect((await request(app).get('/ads/status').set(auth)).body.rewardedLeft).toBe(4);
    expect((await request(app).get('/ads/status')).status).toBe(401);
  });
});

describe('AD-3 SSV helpers', () => {
  it('AD-3 the signed message is everything before &signature=', () => {
    expect(splitSigned('a=1&b=2&signature=SIG&key_id=7')).toEqual({ message: 'a=1&b=2', signature: 'SIG', keyId: '7' });
    expect(splitSigned('a=1&b=2')).toBeNull();
  });

  it('AD-3 Google keys are cached and re-fetched on an unknown key id', async () => {
    const body = { keys: [{ keyId: 7, pem: 'PEM', base64: 'x' }] };
    const fetchFn = vi.fn(async () => new Response(JSON.stringify(body), { status: 200 }));
    const source = googleKeys(fetchFn as unknown as typeof fetch);
    expect(await source(false)).toEqual([{ keyId: '7', pem: 'PEM' }]);
    await source(false);
    expect(fetchFn).toHaveBeenCalledTimes(1);
    await source(true);
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });
});
