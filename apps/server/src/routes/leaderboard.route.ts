import { Router } from 'express';
import { getLeaderboard } from '../controllers/leaderboard.controller.js';
import { optionalAuth } from '../middleware/auth.middleware.js';

/** RANK-6: GET /leaderboard (signed in → also the caller's rank). */
export function leaderboardRouter(jwtSecret: string): Router {
  const r = Router();
  r.get('/', optionalAuth(jwtSecret), getLeaderboard);
  return r;
}
