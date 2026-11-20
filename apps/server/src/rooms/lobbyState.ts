import { schema, t, type SchemaType } from '@colyseus/schema';
import type { Format } from '@carrom/rules';
import { seatsFor } from '@carrom/rules';

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
}, 'PlayerState');
export type PlayerState = SchemaType<typeof PlayerState>;

/**
 * ROOM-3: the small synced lobby state. Game state travels in protocol
 * messages, not here. `players` is keyed by sessionId.
 */
export const LobbyState = schema({
  code: t.string(),
  phase: t.string(),
  format: t.string(),
  preset: t.string(),
  lengthKind: t.string(),
  target: t.uint16(),
  hostId: t.string(),
  /** RANK-2 a ranked room: no host, starts when both matched players are in. */
  ranked: t.boolean(),
  players: t.map(PlayerState),
}, 'LobbyState');
export type LobbyState = SchemaType<typeof LobbyState>;

/** ROOM-3: seats fill in join order (seatsFor order); null when the room is full. */
export function freeSeat(taken: readonly number[], format: Format): number | null {
  return seatsFor(format).find((s) => !taken.includes(s)) ?? null;
}

/** ROOM-3: may seats a and b be swapped in this format? */
export function canSwap(a: number, b: number, format: Format): boolean {
  const seats: number[] = seatsFor(format);
  return a !== b && seats.includes(a) && seats.includes(b);
}

/** The seat every player in `seats` moves to when a and b swap. */
export function swapped(seat: number, a: number, b: number): number {
  return seat === a ? b : seat === b ? a : seat;
}
