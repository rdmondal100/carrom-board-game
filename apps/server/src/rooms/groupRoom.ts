import { randomBytes, timingSafeEqual } from 'node:crypto';
import { matchMaker } from '@colyseus/core';
import { GAME_ROOM, type GroupPlayers, type StartGroupRoomResponse } from '@carrom/protocol';
import { groupConfig } from '../utils/groupConfig.js';

/**
 * ADDA-3: only the server makes group rooms (their games are recorded for the
 * group). It passes this per-process key; a client asking Colyseus for a room
 * with a made-up group can't know it, and gets a plain private room.
 */
const GROUP_KEY = randomBytes(24).toString('base64url');

interface GroupRoomOptions { gameId: string; config: unknown; group: { key: string; id: string } }

/** The group id of a server-made group room's create options, or '' (a plain private room). */
export function groupIdOf(options: unknown): string {
  const g = (options as { group?: { key?: unknown; id?: unknown } } | null)?.group;
  if (typeof g?.key !== 'string' || typeof g.id !== 'string') return '';
  const given = Buffer.from(g.key);
  const ours = Buffer.from(GROUP_KEY);
  return given.length === ours.length && timingSafeEqual(given, ours) ? g.id : '';
}

export class UnknownGameError extends Error {}

/** ADDA-3 / ADDA-4 make a private room of `gameId` for a group; throws UnknownGameError for a game we can't run. */
export async function createGroupRoom(groupId: string, gameId: string, players: GroupPlayers): Promise<StartGroupRoomResponse> {
  const config = groupConfig(gameId, players);
  if (config === null) throw new UnknownGameError('Unknown game');
  const options: GroupRoomOptions = { gameId, config, group: { key: GROUP_KEY, id: groupId } };
  const room = await matchMaker.createRoom(GAME_ROOM, options);
  const code = (room.metadata as { code?: unknown } | undefined)?.code;
  return { roomId: room.roomId, code: typeof code === 'string' ? code : '', gameId };
}
