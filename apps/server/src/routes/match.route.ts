import { Router } from 'express';
import { getMyMatches } from '../controllers/match.controller.js';
import { requireAuth } from '../middleware/auth.middleware.js';

/** RANK-6: GET /matches/me */
export function matchRouter(jwtSecret: string): Router {
  const r = Router();
  r.get('/me', requireAuth(jwtSecret), getMyMatches);
  return r;
}
