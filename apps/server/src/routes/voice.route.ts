import { Router } from 'express';
import { iceServers } from '../controllers/voice.controller.js';
import { requireAuth } from '../middleware/auth.middleware.js';
import type { IceConfig } from '../utils/turn.js';

/** VOICE-3: /voice/* */
export function voiceRouter(jwtSecret: string, cfg: IceConfig): Router {
  const r = Router();
  r.get('/ice', requireAuth(jwtSecret), iceServers(cfg));
  return r;
}
