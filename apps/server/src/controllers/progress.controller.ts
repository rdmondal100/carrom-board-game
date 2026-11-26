import type { RequestHandler, Response } from 'express';
import { z } from 'zod';
import type { ProgressResponse } from '@carrom/protocol/api';
import { User } from '../models/user.model.js';
import { logger } from '../utils/logger.js';
import { claimMission, ensureMissions, progressView, ProgressError, swapMission } from '../utils/progress.js';
import { levelUpOf } from '../utils/wallet.js';
import { userIdOr401 } from './wallet.controller.js';

const indexParam = z.coerce.number().int().min(0).max(9);

/** The `:index` route param, or a 404 answer and null. */
function indexOr404(raw: unknown, res: Response): number | null {
  const r = indexParam.safeParse(raw);
  if (r.success) return r.data;
  res.status(404).json({ error: 'No such mission today' });
  return null;
}

async function send(res: Response, userId: string, reward?: ProgressResponse['reward']): Promise<void> {
  await ensureMissions(userId);
  const user = await User.findById(userId);
  if (!user) {
    res.status(401).json({ error: 'Account not found' });
    return;
  }
  res.status(200).json(progressView(user, new Date(), reward) satisfies ProgressResponse);
}

function fail(res: Response, err: unknown, what: string): void {
  if (err instanceof ProgressError) {
    res.status(err.status).json({ error: err.message });
    return;
  }
  logger.error(`${what} failed`, err);
  res.status(500).json({ error: `${what} failed` });
}

/** PRG-7 GET /me/progress → level, streak and today's missions. */
export const getProgress: RequestHandler = async (_req, res) => {
  try {
    const userId = userIdOr401(res);
    if (!userId) return;
    await send(res, userId);
  } catch (err) {
    fail(res, err, 'Progress');
  }
};

/** PRG-4 POST /me/missions/:index/claim → progress with `reward`; 400 not complete, 409 claimed, 404 no mission. */
export const claim: RequestHandler = async (req, res) => {
  try {
    const userId = userIdOr401(res);
    if (!userId) return;
    const index = indexOr404(req.params.index, res);
    if (index === null) return;
    const g = await claimMission(userId, index);
    await send(res, userId, { coins: g.coins, xp: g.xp, ...levelUpOf(g) });
  } catch (err) {
    fail(res, err, 'Mission claim');
  }
};

/** PRG-5 POST /me/missions/:index/swap → progress; 409 when no swap is left or it was claimed. */
export const swap: RequestHandler = async (req, res) => {
  try {
    const userId = userIdOr401(res);
    if (!userId) return;
    const index = indexOr404(req.params.index, res);
    if (index === null) return;
    await swapMission(userId, index);
    await send(res, userId);
  } catch (err) {
    fail(res, err, 'Mission swap');
  }
};
