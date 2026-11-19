import type { Request, Response } from 'express';
import type { RoomLookupResponse } from '@carrom/protocol';
import { findRoomByCode, normaliseInviteCode } from '../utils/inviteCode.js';
import { logger } from '../utils/logger.js';

export const ROOM_NOT_FOUND = 'No room with that code';

/** ROOM-1: GET /rooms/:code → { roomId } or 404. */
export async function getRoomByCode(req: Request, res: Response): Promise<void> {
  try {
    const code = normaliseInviteCode(String(req.params.code ?? ''));
    const roomId = code === null ? null : await findRoomByCode(code);
    if (roomId === null) {
      res.status(404).json({ error: ROOM_NOT_FOUND });
      return;
    }
    res.status(200).json({ roomId } satisfies RoomLookupResponse);
  } catch (err) {
    logger.error('room lookup failed', err);
    res.status(500).json({ error: 'Room lookup failed' });
  }
}
