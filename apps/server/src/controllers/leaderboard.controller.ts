import type { Request, Response } from 'express';
import { isValidObjectId } from 'mongoose';
import type { LeaderboardEntry, LeaderboardResponse } from '@carrom/protocol/api';
import { authedUserId } from '../middleware/auth.middleware.js';
import { User, type UserDoc } from '../models/user.model.js';
import { logger } from '../utils/logger.js';
import { LEADERBOARD_DEFAULT, LEADERBOARD_MAX } from '../utils/rankedConfig.js';

export const BAD_LIMIT = 'limit must be a whole number from 1';

/** `?limit=` as an integer in 1..max; missing → fallback; anything else → null (400). */
export function readLimit(raw: unknown, fallback: number, max: number): number | null {
  if (raw === undefined) return fallback;
  if (typeof raw !== 'string' || !/^\d+$/.test(raw)) return null;
  const n = Number(raw);
  return n >= 1 ? Math.min(n, max) : null;
}

/** Only players with a finished ranked game are on the board. */
const RANKED = { rankedGames: { $gt: 0 } } as const;
/** RANK-6 order: rating high to low, then the older account, then id (stable). */
const ORDER = { rating: -1, createdAt: 1, _id: 1 } as const;

const entry = (u: UserDoc, rank: number): LeaderboardEntry =>
  ({ rank, id: u.id as string, name: u.name, avatar: u.avatar, rating: u.rating });

/** RANK-6: 1 + how many ranked players sort before `u`. */
async function rankOf(u: UserDoc): Promise<number> {
  const ahead = await User.countDocuments({
    ...RANKED,
    $or: [
      { rating: { $gt: u.rating } },
      { rating: u.rating, createdAt: { $lt: u.createdAt } },
      { rating: u.rating, createdAt: u.createdAt, _id: { $lt: u._id } },
    ],
  });
  return ahead + 1;
}

/** RANK-6: GET /leaderboard?limit=100 → top players + the caller's row (when ranked). */
export async function getLeaderboard(req: Request, res: Response): Promise<void> {
  try {
    const limit = readLimit(req.query.limit, LEADERBOARD_DEFAULT, LEADERBOARD_MAX);
    if (limit === null) {
      res.status(400).json({ error: BAD_LIMIT });
      return;
    }
    const top = await User.find(RANKED).sort(ORDER).limit(limit);
    const players = top.map((u, i) => entry(u, i + 1));
    let me: LeaderboardEntry | null = null;
    const userId = authedUserId(res);
    if (userId && isValidObjectId(userId)) {
      const u = await User.findById(userId);
      if (u && u.rankedGames > 0) me = players.find((p) => p.id === u.id) ?? entry(u, await rankOf(u));
    }
    res.status(200).json({ players, me } satisfies LeaderboardResponse);
  } catch (err) {
    logger.error('leaderboard failed', err);
    res.status(500).json({ error: 'Leaderboard failed' });
  }
}
