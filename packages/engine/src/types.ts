/** `boat` is a Nodi Par disc (spec 20): it can enter a whirlpool like a coin. */
export type Kind = 'white' | 'black' | 'red' | 'striker' | 'boat';

export type Seat = 0 | 1 | 2 | 3;

/** Carrom: pocket k is the corner between seat k and seat k + 1 (mod 4). Other tables: an index into `Table.pockets`. */
export type PocketId = 0 | 1 | 2 | 3;

export interface Piece {
  id: string;
  kind: Kind;
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  m: number;
  pocketed: boolean;
}

export interface BoardState {
  pieces: Piece[];
}

export interface ShotInput {
  seat: Seat;
  /** Along the baseline, -BASELINE_HALF..BASELINE_HALF; + is the shooter's right. */
  x: number;
  /** Unit vector, seat-relative: dirY > 0 is straight ahead, dirX > 0 is right. */
  dirX: number;
  dirY: number;
  /** MIN_POWER..1.0 */
  power: number;
}

/** t is milliseconds since the shot started. */
export type ShotEvent =
  | { t: number; type: 'hit'; a: string; b: string }
  | { t: number; type: 'frame'; id: string }
  | { t: number; type: 'pocket'; id: string; pocket: PocketId }
  /** A coin reached a pocket too fast and bounced back out. */
  | { t: number; type: 'pocketBounce'; id: string; pocket: PocketId }
  /** NODI-1 a piece bounced off a fixed round obstacle, `Table.rocks[rock]`. */
  | { t: number; type: 'rock'; id: string; rock: number };

export interface Vec {
  x: number;
  y: number;
}

/** A fixed round obstacle (a Nodi Par rock or bank corner). */
export interface Circle {
  x: number;
  y: number;
  r: number;
}

/**
 * NODI-1 a table's geometry as data. Frames sit at x, y = ±halfL; a piece of
 * kind 'striker' never enters a pocket. `current` is a steady acceleration on
 * every moving piece, L/s² (zero for carrom).
 */
export interface Table {
  halfL: number;
  pockets: readonly Vec[];
  pocketD: number;
  /** A piece crossing the rim faster than this bounces back out, L/s. */
  pocketMaxDropSpeed: number;
  /** Share of the into-the-pocket speed a bounced piece keeps. */
  pocketRestitution: number;
  rocks: readonly Circle[];
  rockRestitution: number;
  current: Vec;
}
