import { randomInt } from 'node:crypto';
import { matchMaker } from '@colyseus/core';
import { GAME_ROOM, INVITE_ALPHABET, INVITE_LENGTH } from '@carrom/protocol';

/** ROOM-1: a random 6-char invite code from the alphabet without 0/O/1/I. */
export function makeInviteCode(pick: (n: number) => number = randomInt): string {
  let code = '';
  for (let i = 0; i < INVITE_LENGTH; i++) code += INVITE_ALPHABET[pick(INVITE_ALPHABET.length)];
  return code;
}

/** The code in canonical form (upper case, trimmed), or null when it can't be one. */
export function normaliseInviteCode(raw: string): string | null {
  const code = raw.trim().toUpperCase();
  if (code.length !== INVITE_LENGTH) return null;
  for (const c of code) if (!INVITE_ALPHABET.includes(c)) return null;
  return code;
}

/** ROOM-1: the id of the live game room with this invite code, or null. */
export async function findRoomByCode(code: string): Promise<string | null> {
  const rooms = await matchMaker.query({ name: GAME_ROOM });
  return rooms.find((r) => (r.metadata as { code?: unknown } | undefined)?.code === code)?.roomId ?? null;
}
