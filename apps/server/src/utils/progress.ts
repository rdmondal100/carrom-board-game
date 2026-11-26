import { isValidObjectId } from 'mongoose';
import {
  dailyMissions, levelNeed, levelOf, levelStart, missionCounts, PROGRESS, streakDay, streakReward, swapPick,
  type GameOutcome, type Mission, type MissionKind, type MissionView,
} from '@carrom/protocol';
import type { ProgressResponse, StreakView } from '@carrom/protocol/api';
import { GAME_IDS } from '@hub/game-kit';
import { toPublicUser, User, type UserDoc } from '../models/user.model.js';
import { dayKey } from './economyConfig.js';

export const MISSION_NOT_FOUND = 'No such mission today';
export const MISSION_NOT_DONE = 'Mission not complete yet';
export const MISSION_CLAIMED = 'Mission already claimed';
export const NO_SWAPS = 'No mission swaps left today';

/** A refused progress action: HTTP status and the error to answer. */
export class ProgressError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
  }
}

const MS_PER_DAY = 86_400_000;

/** The UTC day before `now`. */
export function yesterdayKey(now: Date): string {
  return dayKey(new Date(now.getTime() - MS_PER_DAY));
}

/** A mission as stored on the user (lean or hydrated). */
interface StoredMission {
  id: string; kind: string; game?: string | null; target: number; coins: number; xp: number;
  progress?: number; seen?: string[]; claimed?: boolean;
}

function asMission(m: StoredMission): Mission {
  return { id: m.id, kind: m.kind as MissionKind, game: m.game ?? null, target: m.target, coins: m.coins, xp: m.xp };
}

/** PRG-3 progress so far (variety = distinct games seen), not capped. */
function progressOf(m: StoredMission): number {
  return m.kind === 'variety' ? (m.seen?.length ?? 0) : (m.progress ?? 0);
}

/** PRG-2 give `userId` today's missions if they don't have them yet (deterministic, so racing calls agree). */
export async function ensureMissions(userId: string, now = new Date()): Promise<void> {
  const today = dayKey(now);
  const list = dailyMissions(userId, today, GAME_IDS).map((m) => ({ ...m, progress: 0, seen: [], claimed: false }));
  await User.updateOne({ _id: userId, 'missions.day': { $ne: today } }, { $set: { missions: { day: today, swaps: 0, list } } });
}

/** XP given, and on a level-up the new level and the coins it paid. */
export interface XpGrant { xp: number; level?: number; levelCoins: number }

/**
 * PRG-1 one atomic update that adds `xp` and `coins` (and `set`) when `filter` matches; null when it
 * doesn't. The XP before this very update tells which levels it crossed, so each level pays once even
 * when grants race.
 */
export async function grantXp(
  userId: string, xp: number, coins = 0, filter: Record<string, unknown> = {}, set: Record<string, unknown> = {},
): Promise<XpGrant | null> {
  const before = await User.findOneAndUpdate(
    { ...filter, _id: userId },
    { $inc: { xp, coins }, ...(Object.keys(set).length > 0 ? { $set: set } : {}) },
    { returnDocument: 'before', projection: { xp: 1 } },
  ).lean();
  if (!before) return null;
  const from = levelOf(before.xp ?? 0);
  const to = levelOf((before.xp ?? 0) + xp);
  if (to <= from) return { xp, levelCoins: 0 };
  const levelCoins = (to - from) * PROGRESS.levelUpCoins;
  await User.updateOne({ _id: userId }, { $inc: { coins: levelCoins } });
  return { xp, level: to, levelCoins };
}

/** PRG-3 a rewarded game moves every unclaimed mission it fits, then gives its XP (PRG-1). */
export async function recordGame(userId: string, r: GameOutcome, now = new Date()): Promise<XpGrant> {
  const none = { xp: 0, levelCoins: 0 };
  if (!isValidObjectId(userId)) return none;
  const today = dayKey(now);
  await ensureMissions(userId, now);
  const u = await User.findById(userId, { missions: 1 }).lean();
  const list: StoredMission[] = u?.missions?.day === today ? u.missions.list : [];
  const open = list.filter((m) => !m.claimed && missionCounts(asMission(m), r));
  const counted = open.filter((m) => m.kind !== 'variety').map((m) => m.id);
  const variety = open.filter((m) => m.kind === 'variety').map((m) => m.id);
  if (counted.length > 0 || variety.length > 0) {
    const update: Record<string, unknown> = {};
    const arrayFilters: Record<string, unknown>[] = [];
    if (counted.length > 0) {
      update.$inc = { 'missions.list.$[c].progress': 1 };
      arrayFilters.push({ 'c.id': { $in: counted } });
    }
    if (variety.length > 0) {
      update.$addToSet = { 'missions.list.$[v].seen': r.game };
      arrayFilters.push({ 'v.id': { $in: variety } });
    }
    await User.updateOne({ _id: userId, 'missions.day': today }, update, { arrayFilters });
  }
  return (await grantXp(userId, r.won ? PROGRESS.gameXp.win : PROGRESS.gameXp.loss)) ?? none;
}

/** Today's stored mission at `index`, after making sure today's list exists. */
async function todaysMission(userId: string, index: number, now: Date) {
  const today = dayKey(now);
  await ensureMissions(userId, now);
  const u = await User.findById(userId, { missions: 1 }).lean();
  const list: StoredMission[] = u?.missions?.day === today ? u.missions.list : [];
  const m = list[index];
  if (!u || !m) throw new ProgressError(404, MISSION_NOT_FOUND);
  return { today, list, m, swaps: u.missions?.swaps ?? 0 };
}

/**
 * PRG-4 claim a finished mission: the claimed flag, its coins and its XP in one atomic update
 * that only matches while it is unclaimed and complete, so parallel claims credit once.
 */
export async function claimMission(userId: string, index: number, now = new Date()): Promise<XpGrant & { coins: number }> {
  const { today, m } = await todaysMission(userId, index, now);
  if (m.claimed) throw new ProgressError(409, MISSION_CLAIMED);
  if (progressOf(m) < m.target) throw new ProgressError(400, MISSION_NOT_DONE);
  const at = `missions.list.${index}`;
  const done = m.kind === 'variety' ? { [`${at}.seen.${m.target - 1}`]: { $exists: true } } : { [`${at}.progress`]: { $gte: m.target } };
  const grant = await grantXp(userId, m.xp, m.coins,
    { 'missions.day': today, [`${at}.id`]: m.id, [`${at}.claimed`]: false, ...done }, { [`${at}.claimed`]: true });
  if (!grant) throw new ProgressError(409, MISSION_CLAIMED);
  return { ...grant, coins: m.coins };
}

/** PRG-5 swap one unclaimed mission for another of its tier, PROGRESS.swapsPerDay times a UTC day. */
export async function swapMission(userId: string, index: number, now = new Date()): Promise<void> {
  const { today, list, m, swaps } = await todaysMission(userId, index, now);
  if (m.claimed) throw new ProgressError(409, MISSION_CLAIMED);
  if (swaps >= PROGRESS.swapsPerDay) throw new ProgressError(409, NO_SWAPS);
  const next = swapPick(list.map(asMission), index, userId, today, GAME_IDS, swaps);
  if (!next) throw new ProgressError(409, NO_SWAPS);
  const at = `missions.list.${index}`;
  const r = await User.updateOne(
    { _id: userId, 'missions.day': today, 'missions.swaps': swaps, [`${at}.id`]: m.id, [`${at}.claimed`]: false },
    { $set: { [at]: { ...next, progress: 0, seen: [], claimed: false } }, $inc: { 'missions.swaps': 1 } },
  );
  if (r.modifiedCount !== 1) throw new ProgressError(409, NO_SWAPS);
}

/**
 * PRG-6 the daily bonus by login streak, in one atomic pipeline update that only matches once a UTC
 * day: the day after the last claim adds one day, any other day starts again at 1; the coins come
 * from the new streak. Returns the coins given (0 = already claimed today) and the streak.
 */
export async function claimStreak(userId: string, now = new Date()): Promise<{ coins: number; streak: number }> {
  if (!isValidObjectId(userId)) return { coins: 0, streak: 0 };
  const today = dayKey(now);
  const week = PROGRESS.streakCoins.length;
  const u = await User.findOneAndUpdate(
    { _id: userId, dailyBonusDay: { $ne: today } },
    [
      {
        $set: {
          streak: { $cond: [{ $eq: ['$dailyBonusDay', yesterdayKey(now)] }, { $add: [{ $ifNull: ['$streak', 0] }, 1] }, 1] },
          dailyBonusDay: today,
        },
      },
      {
        $set: {
          coins: { $add: ['$coins', { $arrayElemAt: [[...PROGRESS.streakCoins], { $mod: [{ $subtract: ['$streak', 1] }, week] }] }] },
        },
      },
    ],
    { returnDocument: 'after', updatePipeline: true, projection: { streak: 1 } },
  ).lean();
  if (!u) return { coins: 0, streak: 0 };
  return { coins: streakReward(u.streak ?? 0), streak: u.streak ?? 0 };
}

/** PRG-6 the streak as the client shows it: broken (0) once a day was missed. */
export function streakView(u: Pick<UserDoc, 'dailyBonusDay' | 'streak'>, now = new Date()): StreakView {
  const last = u.dailyBonusDay ?? '';
  const claimedToday = last === dayKey(now);
  const count = claimedToday || last === yesterdayKey(now) ? (u.streak ?? 0) : 0;
  return { count, day: streakDay(claimedToday ? count : count + 1), claimedToday };
}

function missionView(m: StoredMission): MissionView {
  return { ...asMission(m), progress: Math.min(m.target, progressOf(m)), claimed: m.claimed ?? false };
}

/** PRG-7 everything the progress screen needs (call ensureMissions first for today's list). */
export function progressView(u: UserDoc, now = new Date(), reward?: ProgressResponse['reward']): ProgressResponse {
  const today = dayKey(now);
  const xp = u.xp ?? 0;
  const level = levelOf(xp);
  const mine = u.missions?.day === today;
  return {
    day: today,
    xp,
    level,
    levelXp: xp - levelStart(level),
    levelNeed: levelNeed(level),
    streak: streakView(u, now),
    missions: mine ? u.missions!.list.map((m) => missionView(m)) : [],
    swapsLeft: Math.max(0, PROGRESS.swapsPerDay - (mine ? u.missions!.swaps : 0)),
    ...(reward ? { reward } : {}),
    user: toPublicUser(u),
  };
}
