import { Router } from 'express';
import { claim, getProgress, swap } from '../controllers/progress.controller.js';
import { buy, equip } from '../controllers/shop.controller.js';
import { block, unblock } from '../controllers/report.controller.js';
import { botReward, dailyBonus } from '../controllers/wallet.controller.js';
import { requireAuth } from '../middleware/auth.middleware.js';

/** COS-3: /shop/* */
export function shopRouter(jwtSecret: string): Router {
  const r = Router();
  r.post('/buy', requireAuth(jwtSecret), buy);
  return r;
}

/** COS-2 / COS-4 / VOICE-6 / PRG-4..7: /me/* (equip, daily bonus, Vs-bot rewards, blocks, progress, missions). */
export function meRouter(jwtSecret: string): Router {
  const r = Router();
  r.use(requireAuth(jwtSecret));
  r.patch('/equip', equip);
  r.post('/daily-bonus', dailyBonus);
  r.post('/bot-reward', botReward);
  r.post('/block', block);
  r.delete('/block/:userId', unblock);
  r.get('/progress', getProgress);
  r.post('/missions/:index/claim', claim);
  r.post('/missions/:index/swap', swap);
  return r;
}
