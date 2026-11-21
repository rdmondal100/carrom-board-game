import { Router } from 'express';
import { verifyPurchase, type IapSetup } from '../controllers/iap.controller.js';
import { requireAuth } from '../middleware/auth.middleware.js';

/** IAP-2/3: POST /iap/verify (signed in). `billing` null = purchases off (503). HAPP-9 `packages` = the apps allowed. */
export function iapRouter(jwtSecret: string, setup: IapSetup): Router {
  const r = Router();
  r.post('/verify', requireAuth(jwtSecret), verifyPurchase(setup));
  return r;
}
