import { isValidObjectId } from 'mongoose';
import { User } from '../models/user.model.js';
import { dayKey, ECONOMY } from './economyConfig.js';

/** COS-2 coins for one finished game. */
export function gameReward(won: boolean): number {
  return won ? ECONOMY.win : ECONOMY.loss;
}

/**
 * COS-2 daily login bonus: one atomic update that only matches when today's
 * bonus has not been given. Returns the coins given (0 when already claimed).
 */
export async function claimDailyBonus(userId: string, now = new Date()): Promise<number> {
  const today = dayKey(now);
  const r = await User.updateOne(
    { _id: userId, dailyBonusDay: { $ne: today } },
    { $set: { dailyBonusDay: today }, $inc: { coins: ECONOMY.dailyBonus } },
  );
  return r.modifiedCount === 1 ? ECONOMY.dailyBonus : 0;
}

/**
 * COS-2 a Vs-bot game the client reports: rewarded at most
 * ECONOMY.botGamesPerDay times per UTC day. Each step is one atomic update,
 * so parallel reports can't pass the cap. Returns the coins given.
 */
export async function claimBotReward(userId: string, won: boolean, now = new Date()): Promise<number> {
  return claimCapped(userId, { day: 'botRewardDay', count: 'botRewards' }, ECONOMY.botGamesPerDay, gameReward(won), now);
}

/** The User fields that hold one daily cap: the UTC day counted and how many were given that day. */
export interface CapFields { day: 'botRewardDay' | 'adRewardDay'; count: 'botRewards' | 'adRewards' }

/**
 * Give `coins` unless `cap` rewards of this kind were already given today
 * (COS-2 bot games, AD-3 rewarded ads). Each step is one atomic update, so
 * parallel claims can't pass the cap. Returns the coins given (0 = capped).
 */
export async function claimCapped(
  userId: string, f: CapFields, cap: number, coins: number, now = new Date(),
): Promise<number> {
  if (!isValidObjectId(userId)) return 0;
  const today = dayKey(now);
  // Same day, under the cap: count one more.
  const sameDay = async () => (await User.updateOne(
    { _id: userId, [f.day]: today, [f.count]: { $lt: cap } },
    { $inc: { [f.count]: 1, coins } },
  )).modifiedCount === 1;
  // First reward of a new day: start the count at 1.
  const newDay = async () => (await User.updateOne(
    { _id: userId, [f.day]: { $ne: today } },
    { $set: { [f.day]: today, [f.count]: 1 }, $inc: { coins } },
  )).modifiedCount === 1;
  // A parallel claim may start the day between the first two steps; then count on it.
  return (await sameDay()) || (await newDay()) || (await sameDay()) ? coins : 0;
}

/** How many more capped rewards of this kind `userId` can get today. */
export async function cappedLeft(userId: string, f: CapFields, cap: number, now = new Date()): Promise<number> {
  const u = await User.findById(userId, { [f.day]: 1, [f.count]: 1 }).lean();
  if (!u) return 0;
  const doc = u as unknown as Record<string, unknown>;
  const used = doc[f.day] === dayKey(now) && typeof doc[f.count] === 'number' ? (doc[f.count] as number) : 0;
  return Math.max(0, cap - used);
}

/** COS-2 an online game's rewards: `won` per user id. Returns the coins each user got. */
export async function rewardOnlineGame(results: { userId: string; won: boolean }[]): Promise<Map<string, number>> {
  const given = new Map<string, number>();
  await Promise.all(results.filter((r) => isValidObjectId(r.userId)).map(async (r) => {
    const coins = gameReward(r.won);
    const out = await User.updateOne({ _id: r.userId }, { $inc: { coins } });
    if (out.modifiedCount === 1) given.set(r.userId, coins);
  }));
  return given;
}
