import type { RequestHandler } from 'express';
import { isValidObjectId } from 'mongoose';
import { z } from 'zod';
import { REPORT_REASONS } from '@carrom/protocol';
import type { MeResponse } from '@carrom/protocol/api';
import { Friendship, pairOf } from '../models/friendship.model.js';
import { Report } from '../models/report.model.js';
import { isDuplicateKey, toPublicUser, User } from '../models/user.model.js';
import { logger } from '../utils/logger.js';
import { parseBody } from './auth.controller.js';
import { userIdOr401 } from './wallet.controller.js';

/** VOICE-6 keeps the user document small; nobody needs more blocks than this. */
export const BLOCK_MAX = 500;

const objectId = z.string().refine((v) => isValidObjectId(v), 'Unknown player');
const reportBody = z.strictObject({
  userId: objectId, matchId: z.string().min(1).max(64), reason: z.enum(REPORT_REASONS),
});
const blockBody = z.strictObject({ userId: objectId });

/** VOICE-6 POST /reports { userId, matchId, reason } → 201 (200 when already reported for this match). */
export const report: RequestHandler = async (req, res) => {
  try {
    const body = parseBody(reportBody, req, res);
    if (!body) return;
    const reporterId = userIdOr401(res);
    if (!reporterId) return;
    if (body.userId === reporterId) {
      res.status(400).json({ error: 'You cannot report yourself' });
      return;
    }
    if (!(await User.exists({ _id: body.userId }))) {
      res.status(404).json({ error: 'Unknown player' });
      return;
    }
    try {
      await Report.create({ reporterId, ...body });
    } catch (err) {
      if (!isDuplicateKey(err)) throw err;
      res.status(200).json({ ok: true });
      return;
    }
    res.status(201).json({ ok: true });
  } catch (err) {
    logger.error('report failed', err);
    res.status(500).json({ error: 'Report failed' });
  }
};

/** VOICE-6 / ADDA-1 POST /me/block { userId } → { user } (blocking twice is fine; ends a friendship). */
export const block: RequestHandler = async (req, res) => {
  try {
    const body = parseBody(blockBody, req, res);
    if (!body) return;
    const userId = userIdOr401(res);
    if (!userId) return;
    if (body.userId === userId) {
      res.status(400).json({ error: 'You cannot block yourself' });
      return;
    }
    // Already blocked, or room for one more.
    const user = await User.findOneAndUpdate(
      { _id: userId, $or: [{ blocked: body.userId }, { [`blocked.${BLOCK_MAX - 1}`]: { $exists: false } }] },
      { $addToSet: { blocked: body.userId } },
      { returnDocument: 'after' },
    );
    if (!user) {
      const exists = await User.exists({ _id: userId });
      res.status(exists ? 400 : 401).json({ error: exists ? 'Too many blocked players' : 'Account not found' });
      return;
    }
    // ADDA-1 blocking ends any friendship or request between the two.
    await Friendship.deleteOne(pairOf(userId, body.userId));
    res.status(200).json({ user: toPublicUser(user) } satisfies MeResponse);
  } catch (err) {
    logger.error('block failed', err);
    res.status(500).json({ error: 'Block failed' });
  }
};

/** VOICE-6 DELETE /me/block/:userId → { user } */
export const unblock: RequestHandler = async (req, res) => {
  try {
    const userId = userIdOr401(res);
    if (!userId) return;
    const user = await User.findByIdAndUpdate(userId, { $pull: { blocked: String(req.params.userId) } }, { returnDocument: 'after' });
    if (!user) {
      res.status(401).json({ error: 'Account not found' });
      return;
    }
    res.status(200).json({ user: toPublicUser(user) } satisfies MeResponse);
  } catch (err) {
    logger.error('unblock failed', err);
    res.status(500).json({ error: 'Unblock failed' });
  }
};
