import { Router } from 'express';
import { verifyPurchase } from '../controllers/iap.controller.js';
import { requireAuth } from '../middleware/auth.middleware.js';
import type { PlayBilling } from '../utils/playBilling.js';

/** IAP-2/3: POST /iap/verify (signed in). `billing` null = purchases off (503). */
export function iapRouter(jwtSecret: string, billing: PlayBilling | null): Router {
  const r = Router();
  r.post('/verify', requireAuth(jwtSecret), verifyPurchase(billing));
  return r;
}
