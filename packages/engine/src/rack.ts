import { config, type Config } from './config';
import { baselinePoint, seatForward, seatOutward, seatRight } from './seats';
import type { BoardState, Kind, Piece, Seat } from './types';

const H = Math.sqrt(3) / 2;
// Hex directions at 0°, 60°, … 300° and the in-between 30°, 90°, … 330°,
// as (cos, sin) pairs written without trig.
const HEX: readonly (readonly [number, number])[] = [
  [1, 0], [0.5, H], [-0.5, H], [-1, 0], [-0.5, -H], [0.5, -H],
];
const HEX_MID: readonly (readonly [number, number])[] = [
  [H, 0.5], [0, 1], [-H, 0.5], [-H, -0.5], [0, -1], [H, -0.5],
];

function makePiece(id: string, kind: Kind, x: number, y: number, cfg: Config): Piece {
  const striker = kind === 'striker';
  return {
    id, kind, x, y, vx: 0, vy: 0,
    r: (striker ? cfg.STRIKER_D : cfg.COIN_D) / 2,
    m: striker ? cfg.STRIKER_MASS : cfg.COIN_MASS,
    pocketed: false,
  };
}

/**
 * Red on centre; inner ring of 6 touching red (alternating, black first);
 * outer ring of 12: white at the hex corners (2d), black between (√3·d).
 * Rotated so an outer white points at the breaking seat. The striker waits
 * at the centre of the breaking seat's baseline.
 */
export function createRack(breakingSeat: Seat, cfg: Config = config): BoardState {
  const d = cfg.COIN_D;
  const o = seatOutward(breakingSeat);
  const p = { x: -o.y, y: o.x };
  const at = (dir: readonly [number, number], dist: number) => ({
    x: (o.x * dir[0] + p.x * dir[1]) * dist,
    y: (o.y * dir[0] + p.y * dir[1]) * dist,
  });

  const pieces: Piece[] = [makePiece('red', 'red', 0, 0, cfg)];
  let w = 0;
  let b = 0;
  HEX.forEach((dir) => {
    const q = at(dir, 2 * d);
    pieces.push(makePiece(`w${++w}`, 'white', q.x, q.y, cfg));
  });
  HEX_MID.forEach((dir) => {
    const q = at(dir, Math.sqrt(3) * d);
    pieces.push(makePiece(`b${++b}`, 'black', q.x, q.y, cfg));
  });
  HEX.forEach((dir, k) => {
    const q = at(dir, d);
    const black = k % 2 === 0;
    const id = black ? `b${++b}` : `w${++w}`;
    pieces.push(makePiece(id, black ? 'black' : 'white', q.x, q.y, cfg));
  });

  const s = baselinePoint(breakingSeat, 0, cfg);
  pieces.push(makePiece('striker', 'striker', s.x, s.y, cfg));
  return { pieces };
}

/**
 * Find where the striker can sit on `seat`'s baseline nearest to `x`.
 * Clamps to ±BASELINE_HALF and slides off any coin it would overlap.
 * Pure: the state is not changed. ok is false when no spot is free.
 */
export function placeStriker(
  state: BoardState,
  seat: number,
  x: number,
  cfg: Config = config,
): { ok: boolean; x: number } {
  const s = seat as Seat;
  const half = cfg.BASELINE_HALF;
  const want = Math.min(half, Math.max(-half, x));
  const base = baselinePoint(s, 0, cfg);
  const f = seatForward(s);
  const r = seatRight(s);
  const rs = cfg.STRIKER_D / 2;

  // Coins in baseline coordinates: `along` the baseline and `across` it.
  const coins = state.pieces
    .filter((c) => !c.pocketed && c.kind !== 'striker')
    .map((c) => {
      const dx = c.x - base.x;
      const dy = c.y - base.y;
      return { along: dx * r.x + dy * r.y, across: dx * f.x + dy * f.y, reach: rs + c.r };
    });

  const free = (pos: number) =>
    pos >= -half && pos <= half &&
    coins.every((c) => {
      const da = pos - c.along;
      return da * da + c.across * c.across >= c.reach * c.reach;
    });

  if (free(want)) return { ok: true, x: want };

  // The nearest free spot is where the striker just touches some coin,
  // or one end of the baseline.
  const candidates = [-half, half];
  coins.forEach((c) => {
    const h2 = c.reach * c.reach - c.across * c.across;
    if (h2 <= 0) return;
    const h = Math.sqrt(h2) + cfg.PLACE_GAP;
    candidates.push(c.along - h, c.along + h);
  });
  let best: number | null = null;
  candidates.forEach((pos) => {
    if (!free(pos)) return;
    if (best === null || Math.abs(pos - want) < Math.abs(best - want)) best = pos;
  });
  return best === null ? { ok: false, x: want } : { ok: true, x: best };
}
