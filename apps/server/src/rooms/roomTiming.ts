import { BOT_MAX_THINK_MS, BOT_MIN_THINK_MS } from '@carrom/bot';
import { RULES } from '@carrom/rules';

/** Every wait in a game room. Tests pass shorter ones through `createServer`. */
export interface RoomTiming {
  /** ROOM-7 time a player sees on the clock. */
  shotClockMs: number;
  /** ROOM-7 extra server wait after the clock, for network lag. */
  graceMs: number;
  /** ROOM-8 seconds a dropped player may come back in. */
  reconnectS: number;
  /** ROOM-7 server bot "think" time range. */
  botMinMs: number;
  botMaxMs: number;
  /** ROOM-6 at most one relayed aim per this many ms per player (10/s). */
  aimGapMs: number;
  /** ROOM-10 at most one emote per this many ms per player. */
  emoteGapMs: number;
}

export const DEFAULT_TIMING: RoomTiming = {
  shotClockMs: RULES.SHOT_CLOCK_MS,
  graceMs: 1000,
  reconnectS: 60,
  botMinMs: BOT_MIN_THINK_MS,
  botMaxMs: BOT_MAX_THINK_MS,
  aimGapMs: 100,
  emoteGapMs: 2000,
};

/** ROOM-7: the server bot plays taken-over seats at this level. */
export const ROOM_BOT_LEVEL = 'medium' as const;

/** True when `key` acted less than `gapMs` ago (then it is dropped); else records now. */
export function throttled(last: Map<string, number>, key: string, gapMs: number, now = Date.now()): boolean {
  if (now - (last.get(key) ?? -Infinity) < gapMs) return true;
  last.set(key, now);
  return false;
}
