import type { Format, Length, Preset } from '@carrom/rules';
import { z } from 'zod';

/** ROOM-10: the fixed emote set (no free text chat). */
export const EMOTES = ['wow', 'nice', 'oops', 'gg', 'hurry', 'thanks', 'laugh', 'angry'] as const;
export type EmoteId = (typeof EMOTES)[number];

/** ROOM-1: invite codes use this alphabet (no 0/O/1/I). */
export const INVITE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const INVITE_LENGTH = 6;

/** Name of the Colyseus room type for private games. */
export const GAME_ROOM = 'game';
/** Every protocol message travels on this one Colyseus message type. */
export const MSG = 'msg';

/** ROOM-1: what a client asks for when it creates a room. */
export interface CreateRoomOptions { format: Format; preset: Preset; length: Length }

export const CreateRoomOptionsSchema: z.ZodType<CreateRoomOptions> = z.object({
  format: z.enum(['1v1', '2v2']),
  preset: z.enum(['colour', 'point']),
  length: z.union([
    z.object({ kind: z.literal('board') }),
    z.object({ kind: z.literal('points'), target: z.union([z.literal(19), z.literal(29), z.literal(300)]) }),
  ]),
});

export type RoomPhase = 'lobby' | 'playing' | 'ended';

/** ROOM-3: one person in the room, as the synced lobby state shows them. */
export interface PlayerView {
  sessionId: string;
  userId: string;
  name: string;
  avatar: number;
  seat: number;
  /** Connected now (false while away, ROOM-8). */
  ready: boolean;
  /** A server bot is playing this seat (RUL-10 takeover or ROOM-8). */
  bot: boolean;
  /** Gone for good; the bot keeps the seat. */
  left: boolean;
  /** ROOM-9 voted for a rematch. */
  rematch: boolean;
}

/** ROOM-3: the synced lobby state as plain data (`room.state.toJSON()`). */
export interface LobbyView {
  code: string;
  phase: RoomPhase;
  format: Format;
  preset: Preset;
  /** 'board' or 'points'. */
  lengthKind: string;
  /** Points target; 0 for a one-board game. */
  target: number;
  hostId: string;
  players: Record<string, PlayerView>;
}

/** GET /rooms/:code */
export interface RoomLookupResponse { roomId: string }

/** The Length a lobby view describes. */
export function lengthOf(v: Pick<LobbyView, 'lengthKind' | 'target'>): Length {
  return v.lengthKind === 'points' && (v.target === 19 || v.target === 29 || v.target === 300)
    ? { kind: 'points', target: v.target }
    : { kind: 'board' };
}
