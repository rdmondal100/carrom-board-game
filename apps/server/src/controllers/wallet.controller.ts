import type { RequestHandler, Response } from 'express';
import { isValidObjectId } from 'mongoose';
import { z } from 'zod';
import type { RewardResponse } from '@carrom/protocol/api';
import { AUTH_REQUIRED, authedUserId } from '../middleware/auth.middleware.js';
import { toPublicUser, User } from '../models/user.model.js';
import { logger } from '../utils/logger.js';
import { claimBotReward, claimDailyBonus } from '../utils/wallet.js';
import { parseBody } from './auth.controller.js';

const botRewardBody = z.strictObject({ won: z.boolean() });

/** The signed-in user's id, or a 401 answer and null. */
export function userIdOr401(res: Response): string | null {
  const id = authedUserId(res);
  if (id && isValidObjectId(id)) return id;
  res.status(401).json({ error: AUTH_REQUIRED });
  return null;
}

async function answer(res: Response, userId: string, reward: number): Promise<void> {
  const user = await User.findById(userId);
  if (!user) {
    res.status(401).json({ error: 'Account not found' });
    return;
  }
  res.status(200).json({ reward, user: toPublicUser(user) } satisfies RewardResponse);
}

/** COS-2 POST /me/daily-bonus → { reward: 20 | 0, user } */
export const dailyBonus: RequestHandler = async (_req, res) => {
  try {
    const userId = userIdOr401(res);
    if (!userId) return;
    await answer(res, userId, await claimDailyBonus(userId));
  } catch (err) {
    logger.error('daily bonus failed', err);
    res.status(500).json({ error: 'Daily bonus failed' });
  }
};

/** COS-2 POST /me/bot-reward { won } → { reward, user }; reward 0 once today's cap is used. */
export const botReward: RequestHandler = async (req, res) => {
  try {
    const body = parseBody(botRewardBody, req, res);
    if (!body) return;
    const userId = userIdOr401(res);
    if (!userId) return;
    await answer(res, userId, await claimBotReward(userId, body.won));
  } catch (err) {
    logger.error('bot reward failed', err);
    res.status(500).json({ error: 'Bot reward failed' });
  }
};
