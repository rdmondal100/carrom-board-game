import { Router } from 'express';
import { report } from '../controllers/report.controller.js';
import { requireAuth } from '../middleware/auth.middleware.js';

/** VOICE-6: /reports */
export function reportRouter(jwtSecret: string): Router {
  const r = Router();
  r.post('/', requireAuth(jwtSecret), report);
  return r;
}
