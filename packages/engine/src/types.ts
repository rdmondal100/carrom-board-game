export type Kind = 'white' | 'black' | 'red' | 'striker';

export type Seat = 0 | 1 | 2 | 3;

/** Pocket k is the corner between seat k and seat k + 1 (mod 4). */
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
  | { t: number; type: 'pocketBounce'; id: string; pocket: PocketId };

export interface Vec {
  x: number;
  y: number;
}
