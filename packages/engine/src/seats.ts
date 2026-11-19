import { config, type Config } from './config';
import type { Seat, Vec } from './types';

// Seat 0 sits at +y. Turns pass to the player's right, so going round:
// seat 1 at -x, seat 2 at -y, seat 3 at +x.
const OUTWARD: readonly Vec[] = [
  { x: 0, y: 1 },
  { x: -1, y: 0 },
  { x: 0, y: -1 },
  { x: 1, y: 0 },
];

/** Unit vector from the board centre toward the seat. */
export function seatOutward(seat: Seat): Vec {
  return OUTWARD[seat] as Vec;
}

/** Unit vector the seat faces: straight ahead, toward the board centre. */
export function seatForward(seat: Seat): Vec {
  const o = seatOutward(seat);
  return { x: -o.x, y: -o.y };
}

/** Unit vector to the shooter's right. */
export function seatRight(seat: Seat): Vec {
  const f = seatForward(seat);
  return { x: f.y, y: -f.x };
}

/** World position of a point on the seat's baseline, `along` measured to the right. */
export function baselinePoint(seat: Seat, along: number, cfg: Config = config): Vec {
  const o = seatOutward(seat);
  const r = seatRight(seat);
  const d = cfg.HALF_L - cfg.BASELINE_INSET;
  return { x: o.x * d + r.x * along, y: o.y * d + r.y * along };
}

/** Turn a seat-relative direction into a world direction. */
export function seatToWorld(seat: Seat, dirX: number, dirY: number): Vec {
  const f = seatForward(seat);
  const r = seatRight(seat);
  return { x: r.x * dirX + f.x * dirY, y: r.y * dirX + f.y * dirY };
}
