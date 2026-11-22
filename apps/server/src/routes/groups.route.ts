import { Router } from 'express';
import { groupPlayHandlers } from '../controllers/groupPlay.controller.js';
import { groupHandlers } from '../controllers/groups.controller.js';
import { optionalAuth, requireAuth } from '../middleware/auth.middleware.js';
import type { PresenceStore } from '../utils/presence.js';

/** ADDA-2 / ADDA-3 / ADDA-7: /groups/* */
export function groupsRouter(jwtSecret: string, presence: PresenceStore): Router {
  const g = groupHandlers(presence);
  const play = groupPlayHandlers(presence);
  const auth = requireAuth(jwtSecret);
  const r = Router();
  r.get('/invite/:code', optionalAuth(jwtSecret), g.preview);
  r.post('/join/:code', auth, g.join);
  r.get('/', auth, g.list);
  r.post('/', auth, g.create);
  r.get('/:id', auth, g.get);
  r.patch('/:id', auth, g.update);
  r.post('/:id/leave', auth, g.leave);
  r.delete('/:id/members/:userId', auth, g.removeMember);
  r.post('/:id/rooms', auth, play.startRoom);
  r.get('/:id/leaderboard', auth, play.leaderboard);
  r.post('/:id/report', auth, play.report);
  return r;
}
