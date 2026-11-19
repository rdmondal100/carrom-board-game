import type { Config } from './config';
import { sweptTime } from './collide';
import type { Piece, PocketId, Vec } from './types';

// Pocket k is the corner between seat k and seat k + 1:
// 0 = (-x, +y), 1 = (-x, -y), 2 = (+x, -y), 3 = (+x, +y).
const CORNERS: readonly Vec[] = [
  { x: -1, y: 1 },
  { x: -1, y: -1 },
  { x: 1, y: -1 },
  { x: 1, y: 1 },
];

export const POCKET_IDS: readonly PocketId[] = [0, 1, 2, 3];

/** Centre of a pocket. Each pocket touches both of its frames. */
export function pocketCentre(pocket: PocketId, cfg: Config): Vec {
  const c = CORNERS[pocket] as Vec;
  const d = cfg.HALF_L - cfg.POCKET_INSET;
  return { x: c.x * d, y: c.y * d };
}

/**
 * When a coin's centre first crosses a pocket rim, within maxT, at any
 * speed. The striker never pockets, so it always returns Infinity for it.
 */
export function timeToPocket(
  p: Piece, maxT: number, cfg: Config,
): { t: number; pocket: PocketId } {
  let best = { t: Infinity, pocket: 0 as PocketId };
  if (p.kind === 'striker' || p.pocketed) return best;
  const rim = cfg.POCKET_D / 2;
  POCKET_IDS.forEach((k) => {
    const c = pocketCentre(k, cfg);
    const t = sweptTime(p.x - c.x, p.y - c.y, p.vx, p.vy, rim, maxT);
    if (t < best.t) best = { t, pocket: k };
  });
  return best;
}

/** True if a coin's centre is already inside a pocket rim. */
export function insidePocket(p: Piece, cfg: Config): PocketId | null {
  if (p.kind === 'striker' || p.pocketed) return null;
  const rim = cfg.POCKET_D / 2;
  for (const k of POCKET_IDS) {
    const c = pocketCentre(k, cfg);
    const dx = p.x - c.x;
    const dy = p.y - c.y;
    if (dx * dx + dy * dy < rim * rim) return k;
  }
  return null;
}

/** Take a coin off the board into a pocket. Drops are instant: no closed window. */
export function dropInPocket(p: Piece, pocket: PocketId, cfg: Config): void {
  const c = pocketCentre(pocket, cfg);
  p.pocketed = true;
  p.x = c.x;
  p.y = c.y;
  p.vx = 0;
  p.vy = 0;
}
