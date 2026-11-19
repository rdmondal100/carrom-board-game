import { config, type Config } from './config';
import { POCKET_IDS, pocketCentre } from './pockets';
import type { BoardState, Piece } from './types';

// Only + - * / and comparisons, so every platform picks the same spot.

function isFree(x: number, y: number, p: Piece, others: Piece[], cfg: Config): boolean {
  const edge = cfg.HALF_L - p.r;
  if (x < -edge || x > edge || y < -edge || y > edge) return false;
  const rim = cfg.POCKET_D / 2;
  for (const k of POCKET_IDS) {
    const c = pocketCentre(k, cfg);
    const dx = x - c.x;
    const dy = y - c.y;
    if (dx * dx + dy * dy < rim * rim) return false;
  }
  for (const o of others) {
    const dx = x - o.x;
    const dy = y - o.y;
    // Touching is fine (the red's spot is ringed by touching coins), so
    // PLACE_GAP is a rounding tolerance here, not extra space.
    const reach = p.r + o.r - cfg.PLACE_GAP;
    if (dx * dx + dy * dy < reach * reach) return false;
  }
  return true;
}

/**
 * Put a coin back on the board: on the centre spot, or the nearest free
 * point to it (searched on a fine grid). Returns a new state with the coin
 * at rest and no longer pocketed. Throws if the id is unknown or no spot is free.
 */
export function placeCoin(state: BoardState, id: string, cfg: Config = config): BoardState {
  const next: BoardState = { pieces: state.pieces.map((p) => ({ ...p })) };
  const coin = next.pieces.find((p) => p.id === id);
  if (!coin) throw new RangeError(`No piece with id ${id}`);
  const others = next.pieces.filter((p) => p !== coin && !p.pocketed);

  const step = cfg.PLACE_GRID_STEP;
  const maxRing = Math.floor(cfg.HALF_L / step);
  let best: { x: number; y: number; d2: number } | null = null;
  const consider = (i: number, j: number) => {
    const x = i * step;
    const y = j * step;
    const d2 = x * x + y * y;
    if (best !== null && d2 >= best.d2) return;
    if (isFree(x, y, coin, others, cfg)) best = { x, y, d2 };
  };

  // Square rings around the centre. Every point on ring k is at least
  // k·step away, so stop once that passes the best distance found.
  for (let k = 0; k <= maxRing; k++) {
    if (best !== null) {
      const ringMin = k * step;
      if (ringMin * ringMin > (best as { d2: number }).d2) break;
    }
    if (k === 0) {
      consider(0, 0);
      continue;
    }
    for (let i = -k; i <= k; i++) {
      consider(i, -k);
      consider(i, k);
    }
    for (let j = -k + 1; j <= k - 1; j++) {
      consider(-k, j);
      consider(k, j);
    }
  }

  if (best === null) throw new RangeError(`No free spot to place ${id}`);
  const spot = best as { x: number; y: number };
  coin.x = spot.x;
  coin.y = spot.y;
  coin.vx = 0;
  coin.vy = 0;
  coin.pocketed = false;
  return next;
}
