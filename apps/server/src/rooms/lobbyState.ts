import { schema, t, type SchemaType } from '@colyseus/schema';

/** ROOM-3: one person in the room. Field meanings match protocol `PlayerView`. */
export const PlayerState = schema({
  sessionId: t.string(),
  userId: t.string(),
  name: t.string(),
  avatar: t.uint8(),
  seat: t.int8(),
  ready: t.boolean(),
  bot: t.boolean(),
  left: t.boolean(),
  rematch: t.boolean(),
  /** COS-6 equipped striker item id. */
  striker: t.string(),
  /** COS-6 equipped coin-set item id. */
  coinSet: t.string(),
  /** VOICE-2 takes part in voice (ranked: opted in, VOICE-4). */
  voiceOn: t.boolean(),
  /** VOICE-5 mic off. */
  voiceMuted: t.boolean(),
}, 'PlayerState');
export type PlayerState = SchemaType<typeof PlayerState>;

/**
 * ROOM-3: the small synced lobby state. Game state travels in protocol
 * messages, not here. `players` is keyed by sessionId.
 */
export const LobbyState = schema({
  code: t.string(),
  phase: t.string(),
  /** HUB-4 the game this room plays. */
  gameId: t.string(),
  /** The game settings as JSON (checked by the game module at create). */
  config: t.string(),
  hostId: t.string(),
  /** RANK-2 a ranked room: no host, starts when both matched players are in. */
  ranked: t.boolean(),
  players: t.map(PlayerState),
}, 'LobbyState');
export type LobbyState = SchemaType<typeof LobbyState>;

/**
 * CB-8 a seat the host gave to a bot: nobody's session (`id` is made up), no
 * user, and `left` like a seat whose player is gone for good, so the room
 * treats it the same way (the bot plays it; no coins, no rematch vote).
 */
export function botPlayer(id: string, seat: number): PlayerState {
  return new PlayerState({
    sessionId: id, userId: '', name: '', avatar: 0, seat, ready: true, bot: true, left: true, rematch: false,
    striker: '', coinSet: '', voiceOn: false, voiceMuted: true,
  });
}

/** A seat filled by the host's bot (CB-8), not a person. */
export const isFilledBot = (p: Pick<PlayerState, 'userId' | 'bot'>): boolean => p.bot && p.userId === '';

/** ROOM-3: seats fill in join order (the game's seat order); null when the room is full. */
export function freeSeat(taken: readonly number[], seats: readonly number[]): number | null {
  return seats.find((s) => !taken.includes(s)) ?? null;
}

/** ROOM-3: may seats a and b be swapped in a game with these seats? */
export function canSwap(a: number, b: number, seats: readonly number[]): boolean {
  return a !== b && seats.includes(a) && seats.includes(b);
}

/** The seat every player in `seats` moves to when a and b swap. */
export function swapped(seat: number, a: number, b: number): number {
  return seat === a ? b : seat === b ? a : seat;
}
