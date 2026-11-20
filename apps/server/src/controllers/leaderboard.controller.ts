import type { Request, Response } from 'express';
import { isValidObjectId } from 'mongoose';
import type { LeaderboardEntry, LeaderboardResponse } from '@carrom/protocol/api';
import { authedUserId } from '../middleware/auth.middleware.js';
import { ratingOf, User, type UserDoc } from '../models/user.model.js';
import { isKnownGame } from '../rooms/games.js';
import { logger } from '../utils/logger.js';
import { LEADERBOARD_DEFAULT, LEADERBOARD_MAX } from '../utils/rankedConfig.js';

export const BAD_LIMIT = 'limit must be a whole number from 1';
export const BAD_GAME = 'Unknown game';
/** HUB-9 the game when `?game=` is missing (old clients). */
export const DEFAULT_GAME = 'carrom';

/** `?limit=` as an integer in 1..max; missing → fallback; anything else → null (400). */
export function readLimit(raw: unknown, fallback: number, max: number): number | null {
  if (raw === undefined) return fallback;
  if (typeof raw !== 'string' || !/^\d+$/.test(raw)) return null;
  const n = Number(raw);
  return n >= 1 ? Math.min(n, max) : null;
}

/** HUB-9 `?game=`: a registered game id; missing → carrom; anything else → null (400). */
export function readGame(raw: unknown): string | null {
  if (raw === undefined) return DEFAULT_GAME;
  return isKnownGame(raw) ? raw : null;
}

/** Only players with a finished ranked game of `game` are on its board. */
const ranked = (game: string) => ({ [`ratings.${game}.games`]: { $gt: 0 } });
/** RANK-6 order: rating high to low, then the older account, then id (stable). */
const order = (game: string) => ({ [`ratings.${game}.rating`]: -1, createdAt: 1, _id: 1 } as const);

const entry = (u: UserDoc, game: string, rank: number): LeaderboardEntry =>
  ({ rank, id: u.id as string, name: u.name, avatar: u.avatar, rating: ratingOf(u, game).rating });

/** RANK-6: 1 + how many ranked players of `game` sort before `u`. */
async function rankOf(u: UserDoc, game: string): Promise<number> {
  const r = ratingOf(u, game).rating;
  const path = `ratings.${game}.rating`;
  const ahead = await User.countDocuments({
    ...ranked(game),
    $or: [
      { [path]: { $gt: r } },
      { [path]: r, createdAt: { $lt: u.createdAt } },
      { [path]: r, createdAt: u.createdAt, _id: { $lt: u._id } },
    ],
  });
  return ahead + 1;
}

/** RANK-6 / HUB-9: GET /leaderboard?game=carrom&limit=100 → top players + the caller's row (when ranked). */
export async function getLeaderboard(req: Request, res: Response): Promise<void> {
  try {
    const game = readGame(req.query.game);
    if (game === null) {
      res.status(400).json({ error: BAD_GAME });
      return;
    }
    const limit = readLimit(req.query.limit, LEADERBOARD_DEFAULT, LEADERBOARD_MAX);
    if (limit === null) {
      res.status(400).json({ error: BAD_LIMIT });
      return;
    }
    const top = await User.find(ranked(game)).sort(order(game)).limit(limit);
    const players = top.map((u, i) => entry(u, game, i + 1));
    let me: LeaderboardEntry | null = null;
    const userId = authedUserId(res);
    if (userId && isValidObjectId(userId)) {
      const u = await User.findById(userId);
      if (u && ratingOf(u, game).games > 0) me = players.find((p) => p.id === u.id) ?? entry(u, game, await rankOf(u, game));
    }
    res.status(200).json({ players, me } satisfies LeaderboardResponse);
  } catch (err) {
    logger.error('leaderboard failed', err);
    res.status(500).json({ error: 'Leaderboard failed' });
  }
}
