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
  const today = dayKey(now);
  const coins = gameReward(won);
  // Same day, under the cap: count one more.
  const sameDay = async () => (await User.updateOne(
    { _id: userId, botRewardDay: today, botRewards: { $lt: ECONOMY.botGamesPerDay } },
    { $inc: { botRewards: 1, coins } },
  )).modifiedCount === 1;
  // First bot reward of a new day: start the count at 1.
  const newDay = async () => (await User.updateOne(
    { _id: userId, botRewardDay: { $ne: today } },
    { $set: { botRewardDay: today, botRewards: 1 }, $inc: { coins } },
  )).modifiedCount === 1;
  // A parallel report may start the day between the first two steps; then count on it.
  return (await sameDay()) || (await newDay()) || (await sameDay()) ? coins : 0;
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
