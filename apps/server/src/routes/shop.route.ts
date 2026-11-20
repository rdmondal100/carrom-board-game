import { Router } from 'express';
import { buy, equip } from '../controllers/shop.controller.js';
import { botReward, dailyBonus } from '../controllers/wallet.controller.js';
import { requireAuth } from '../middleware/auth.middleware.js';

/** COS-3: /shop/* */
export function shopRouter(jwtSecret: string): Router {
  const r = Router();
  r.post('/buy', requireAuth(jwtSecret), buy);
  return r;
}

/** COS-2 / COS-4: /me/* (equip, daily bonus, Vs-bot rewards). */
export function meRouter(jwtSecret: string): Router {
  const r = Router();
  r.use(requireAuth(jwtSecret));
  r.patch('/equip', equip);
  r.post('/daily-bonus', dailyBonus);
  r.post('/bot-reward', botReward);
  return r;
}
