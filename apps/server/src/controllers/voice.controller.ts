import type { RequestHandler } from 'express';
import { logger } from '../utils/logger.js';
import { iceServersFor, type IceConfig } from '../utils/turn.js';
import { userIdOr401 } from './wallet.controller.js';

/** VOICE-3 GET /voice/ice → { iceServers, ttl } for the signed-in player. */
export function iceServers(cfg: IceConfig): RequestHandler {
  return (_req, res) => {
    try {
      const userId = userIdOr401(res);
      if (!userId) return;
      res.set('Cache-Control', 'no-store');
      res.status(200).json(iceServersFor(cfg, userId));
    } catch (err) {
      logger.error('ice servers failed', err);
      res.status(500).json({ error: 'Voice setup failed' });
    }
  };
}
