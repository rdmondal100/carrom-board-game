import type { Request, Response } from 'express';
import { isValidObjectId } from 'mongoose';
import type { MatchesResponse } from '@carrom/protocol/api';
import { AUTH_REQUIRED, authedUserId } from '../middleware/auth.middleware.js';
import { Match, toMatchView } from '../models/match.model.js';
import { logger } from '../utils/logger.js';
import { HISTORY_DEFAULT, HISTORY_MAX } from '../utils/rankedConfig.js';
import { BAD_LIMIT, readLimit } from './leaderboard.controller.js';

/** RANK-6: GET /matches/me?limit=20 → the caller's games, newest first. */
export async function getMyMatches(req: Request, res: Response): Promise<void> {
  try {
    const userId = authedUserId(res);
    if (!userId || !isValidObjectId(userId)) {
      res.status(401).json({ error: AUTH_REQUIRED });
      return;
    }
    const limit = readLimit(req.query.limit, HISTORY_DEFAULT, HISTORY_MAX);
    if (limit === null) {
      res.status(400).json({ error: BAD_LIMIT });
      return;
    }
    const docs = await Match.find({ 'players.userId': userId }).sort({ createdAt: -1, _id: -1 }).limit(limit);
    res.status(200).json({ matches: docs.map(toMatchView) } satisfies MatchesResponse);
  } catch (err) {
    logger.error('match history failed', err);
    res.status(500).json({ error: 'Match history failed' });
  }
}
