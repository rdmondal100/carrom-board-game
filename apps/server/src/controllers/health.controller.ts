import type { Request, Response } from 'express';
import { dbState } from '../connectDb.js';
import { VERSION } from '../utils/version.js';
import { logger } from '../utils/logger.js';

export async function getHealth(_req: Request, res: Response): Promise<void> {
  try {
    res.status(200).json({ ok: true, version: VERSION, db: dbState() });
  } catch (err) {
    logger.error('health check failed', err);
    res.status(500).json({ error: 'Health check failed' });
  }
}
