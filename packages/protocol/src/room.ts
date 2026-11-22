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

/** HUB-5 ROOM-1: what a client asks for when it creates a room: the game and its settings (checked by the game module). */
export interface CreateRoomOptions<C = unknown> { gameId: string; config: C }

export const CreateRoomOptionsSchema: z.ZodType<CreateRoomOptions> = z.object({
  gameId: z.string().min(1).max(32),
  config: z.custom<unknown>((v) => v !== undefined),
});

/** Carrom's room settings (the carrom module's config). */
export interface CarromRoomConfig { format: Format; preset: Preset; length: Length }

export const CarromRoomConfigSchema: z.ZodType<CarromRoomConfig> = z.object({
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
  /** COS-6 equipped striker item id (shown to everyone). */
  striker: string;
  /** COS-6 equipped coin-set item id; the board's breaker's set is drawn. */
  coinSet: string;
  /** VOICE-2 takes part in voice (ranked: tapped "Turn on voice", VOICE-4). */
  voiceOn: boolean;
  /** VOICE-5 mic off (always true while `voiceOn` is false). */
  voiceMuted: boolean;
}

/** ROOM-3: the synced lobby state as plain data (`room.state.toJSON()`). */
export interface LobbyView {
  code: string;
  phase: RoomPhase;
  /** HUB-4 which game this room plays. */
  gameId: string;
  /** The game's settings as JSON (parse with that game's config schema). */
  config: string;
  hostId: string;
  /** RANK-2 a ranked game: no host, no invite, no rematch; starts when both players are in. */
  ranked: boolean;
  /** ADDA-3 the group this room was started for ('' or missing = none); its games are recorded for the group. */
  groupId?: string;
  players: Record<string, PlayerView>;
}

/** GET /rooms/:code */
export interface RoomLookupResponse { roomId: string }

/** A lobby's game settings, parsed (null when the JSON is broken). */
export function lobbyConfig(v: Pick<LobbyView, 'config'>): unknown {
  try {
    return JSON.parse(v.config) as unknown;
  } catch {
    return null;
  }
}
