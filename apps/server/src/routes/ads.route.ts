import { Router } from 'express';
import { adStatus, ssvCallback } from '../controllers/ads.controller.js';
import { requireAuth } from '../middleware/auth.middleware.js';
import type { KeySource } from '../utils/admobSsv.js';

/** AD-3: /ads/ssv (AdMob's callback, signed, no token) and /ads/status (the player). */
export function adsRouter(jwtSecret: string, keys: KeySource): Router {
  const r = Router();
  r.get('/ssv', ssvCallback(keys));
  r.get('/status', requireAuth(jwtSecret), adStatus);
  return r;
}
