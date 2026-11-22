import { Router } from 'express';
import { friendHandlers } from '../controllers/friends.controller.js';
import { requireAuth } from '../middleware/auth.middleware.js';
import type { PresenceStore } from '../utils/presence.js';

/** ADDA-1: /friends/* */
export function friendsRouter(jwtSecret: string, presence: PresenceStore): Router {
  const h = friendHandlers(presence);
  const r = Router();
  r.use(requireAuth(jwtSecret));
  r.get('/', h.list);
  r.post('/requests', h.request);
  r.post('/:userId/accept', h.accept);
  r.post('/:userId/decline', h.decline);
  r.delete('/:userId', h.remove);
  return r;
}

/** ADDA-1 / ADDA-6: POST /presence (status beat; answers with new notices). */
export function presenceRouter(jwtSecret: string, presence: PresenceStore): Router {
  const r = Router();
  r.post('/', requireAuth(jwtSecret), friendHandlers(presence).beat);
  return r;
}
