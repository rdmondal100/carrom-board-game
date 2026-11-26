import type { RequestHandler, Response } from 'express';
import { isValidObjectId } from 'mongoose';
import { z } from 'zod';
import type { RewardResponse } from '@carrom/protocol/api';
import { GAME_IDS } from '@hub/game-kit';
import { AUTH_REQUIRED, authedUserId } from '../middleware/auth.middleware.js';
import { toPublicUser, User } from '../models/user.model.js';
import { logger } from '../utils/logger.js';
import { claimStreak } from '../utils/progress.js';
import { claimBotReward, levelUpOf } from '../utils/wallet.js';
import { parseBody } from './auth.controller.js';

const botRewardBody = z.strictObject({
  won: z.boolean(),
  /** PRG-7 the game played (moves that game's missions). */
  game: z.enum(GAME_IDS).default('carrom'),
});

/** The signed-in user's id, or a 401 answer and null. */
export function userIdOr401(res: Response): string | null {
  const id = authedUserId(res);
  if (id && isValidObjectId(id)) return id;
  res.status(401).json({ error: AUTH_REQUIRED });
  return null;
}

async function answer(res: Response, userId: string, reward: number, extra: Omit<RewardResponse, 'reward' | 'user'> = {}): Promise<void> {
  const user = await User.findById(userId);
  if (!user) {
    res.status(401).json({ error: 'Account not found' });
    return;
  }
  res.status(200).json({ reward, ...extra, user: toPublicUser(user) } satisfies RewardResponse);
}

/** COS-2 / PRG-6 POST /me/daily-bonus → { reward: streak day's coins | 0, streak, user } */
export const dailyBonus: RequestHandler = async (_req, res) => {
  try {
    const userId = userIdOr401(res);
    if (!userId) return;
    const { coins, streak } = await claimStreak(userId);
    await answer(res, userId, coins, coins > 0 ? { streak } : {});
  } catch (err) {
    logger.error('daily bonus failed', err);
    res.status(500).json({ error: 'Daily bonus failed' });
  }
};

/** COS-2 POST /me/bot-reward { won, game? } → { reward, xp?, level?, levelCoins?, user }; reward 0 once today's cap is used. */
export const botReward: RequestHandler = async (req, res) => {
  try {
    const body = parseBody(botRewardBody, req, res);
    if (!body) return;
    const userId = userIdOr401(res);
    if (!userId) return;
    const r = await claimBotReward(userId, body.won, body.game);
    await answer(res, userId, r.coins, r.coins > 0 ? { xp: r.xp, ...levelUpOf(r) } : {});
  } catch (err) {
    logger.error('bot reward failed', err);
    res.status(500).json({ error: 'Bot reward failed' });
  }
};
