import { Router } from 'express';
import {
  getMe, google, guest, login, patchMe, register, type AuthConfig,
} from '../controllers/auth.controller.js';
import { optionalAuth, requireAuth } from '../middleware/auth.middleware.js';
import { authRateLimit } from '../middleware/rateLimit.middleware.js';

/** /auth/* (spec 08). Each app gets its own rate-limit counts (AUTH-7). */
export function authRouter(cfg: AuthConfig, rateLimit = authRateLimit()): Router {
  const r = Router();
  r.use(rateLimit);
  r.post('/guest', guest(cfg));
  r.post('/register', optionalAuth(cfg.jwtSecret), register(cfg));
  r.post('/login', login(cfg));
  r.post('/google', optionalAuth(cfg.jwtSecret), google(cfg));
  r.get('/me', requireAuth(cfg.jwtSecret), getMe);
  r.patch('/me', requireAuth(cfg.jwtSecret), patchMe);
  return r;
}
