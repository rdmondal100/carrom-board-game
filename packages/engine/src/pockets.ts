import type { Config } from './config';
import { sweptTime } from './collide';
import type { Piece, PocketId, Table, Vec } from './types';

// Carrom pocket k is the corner between seat k and seat k + 1:
// 0 = (-x, +y), 1 = (-x, -y), 2 = (+x, -y), 3 = (+x, +y).
const CORNERS: readonly Vec[] = [
  { x: -1, y: 1 },
  { x: -1, y: -1 },
  { x: 1, y: -1 },
  { x: 1, y: 1 },
];

export const POCKET_IDS: readonly PocketId[] = [0, 1, 2, 3];

/** Centre of a carrom pocket. Each pocket touches both of its frames. */
export function pocketCentre(pocket: PocketId, cfg: Config): Vec {
  const c = CORNERS[pocket] as Vec;
  const d = cfg.HALF_L - cfg.POCKET_INSET;
  return { x: c.x * d, y: c.y * d };
}

const neverPockets = (p: Piece): boolean => p.kind === 'striker' || p.pocketed;

/**
 * When a piece's centre first crosses a pocket rim, within maxT, at any
 * speed. The striker never pockets, so it always returns Infinity for it.
 */
export function timeToPocket(
  p: Piece, maxT: number, table: Table,
): { t: number; pocket: PocketId } {
  let best = { t: Infinity, pocket: 0 as PocketId };
  if (neverPockets(p)) return best;
  const rim = table.pocketD / 2;
  table.pockets.forEach((c, k) => {
    const t = sweptTime(p.x - c.x, p.y - c.y, p.vx, p.vy, rim, maxT);
    if (t < best.t) best = { t, pocket: k as PocketId };
  });
  return best;
}

/** True if a piece's centre is already inside a pocket rim. */
export function insidePocket(p: Piece, table: Table): PocketId | null {
  if (neverPockets(p)) return null;
  const rim = table.pocketD / 2;
  for (let k = 0; k < table.pockets.length; k++) {
    const c = table.pockets[k] as Vec;
    const dx = p.x - c.x;
    const dy = p.y - c.y;
    if (dx * dx + dy * dy < rim * rim) return k as PocketId;
  }
  return null;
}

/** True when a piece is going too fast to drop: it bounces back out. */
export function bouncesOut(p: Piece, table: Table): boolean {
  const max = table.pocketMaxDropSpeed;
  return p.vx * p.vx + p.vy * p.vy > max * max;
}

/**
 * A too-fast piece hits the back of the pocket and comes out: the speed
 * component into the pocket reverses, scaled by the table's pocket
 * restitution; the sideways component is kept. It is set just outside the rim.
 */
export function bounceOffPocket(p: Piece, pocket: PocketId, table: Table, cfg: Config): void {
  const c = table.pockets[pocket] as Vec;
  let nx = p.x - c.x;
  let ny = p.y - c.y;
  const len = Math.sqrt(nx * nx + ny * ny);
  if (len === 0) {
    // Dead centre (cannot happen from a swept crossing): send it straight back.
    const sp = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
    nx = -p.vx / sp;
    ny = -p.vy / sp;
  } else {
    nx /= len;
    ny /= len;
  }
  const vn = p.vx * nx + p.vy * ny;
  if (vn < 0) {
    const k = (1 + table.pocketRestitution) * vn;
    p.vx -= k * nx;
    p.vy -= k * ny;
  }
  const out = table.pocketD / 2 + cfg.PLACE_GAP;
  p.x = c.x + nx * out;
  p.y = c.y + ny * out;
}

/** Take a piece off the board into a pocket. Drops are instant: no closed window. */
export function dropInPocket(p: Piece, pocket: PocketId, table: Table): void {
  const c = table.pockets[pocket] as Vec;
  p.pocketed = true;
  p.x = c.x;
  p.y = c.y;
  p.vx = 0;
  p.vy = 0;
}
