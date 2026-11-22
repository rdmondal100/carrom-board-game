import type { Config } from './config';
import type { Circle, Piece, Table } from './types';

export type FrameAxis = 'x' | 'y';

/**
 * Earliest time in [0, maxT] at which a point at (px, py) moving with
 * (vx, vy) comes within distance `reach` of the origin. Returns Infinity if
 * it doesn't, or if it is already inside but moving away.
 */
export function sweptTime(
  px: number, py: number, vx: number, vy: number, reach: number, maxT: number,
): number {
  const a = vx * vx + vy * vy;
  const b = 2 * (px * vx + py * vy);
  const c = px * px + py * py - reach * reach;
  if (b >= 0) return Infinity; // not approaching
  if (c <= 0) return 0; // touching or overlapping, and closing in
  if (a === 0) return Infinity;
  const disc = b * b - 4 * a * c;
  if (disc < 0) return Infinity;
  const t = (-b - Math.sqrt(disc)) / (2 * a);
  return t <= maxT ? t : Infinity;
}

/** When two pieces moving in straight lines first touch, within maxT. */
export function timeToPieceHit(a: Piece, b: Piece, maxT: number): number {
  return sweptTime(b.x - a.x, b.y - a.y, b.vx - a.vx, b.vy - a.vy, a.r + b.r, maxT);
}

function axisTime(pos: number, vel: number, limit: number, maxT: number): number {
  if (vel > 0) {
    const t = (limit - pos) / vel;
    return t <= 0 ? 0 : t <= maxT ? t : Infinity;
  }
  if (vel < 0) {
    const t = (-limit - pos) / vel;
    return t <= 0 ? 0 : t <= maxT ? t : Infinity;
  }
  return Infinity;
}

/** When a piece first touches a frame, within maxT, and which axis it hits. */
export function timeToFrameHit(
  p: Piece, maxT: number, table: Table,
): { t: number; axis: FrameAxis } {
  const limit = table.halfL - p.r;
  const tx = axisTime(p.x, p.vx, limit, maxT);
  const ty = axisTime(p.y, p.vy, limit, maxT);
  return tx <= ty ? { t: tx, axis: 'x' } : { t: ty, axis: 'y' };
}

/** Bounce a piece off a frame. The piece must already be touching it. */
export function resolveFrameHit(p: Piece, axis: FrameAxis, table: Table, cfg: Config): void {
  const limit = table.halfL - p.r;
  if (axis === 'x') {
    p.x = p.x > 0 ? Math.min(p.x, limit) : Math.max(p.x, -limit);
    p.vx = -p.vx * cfg.FRAME_RESTITUTION;
  } else {
    p.y = p.y > 0 ? Math.min(p.y, limit) : Math.max(p.y, -limit);
    p.vy = -p.vy * cfg.FRAME_RESTITUTION;
  }
}

/**
 * Collide two touching pieces: an impulse along the line of centres with
 * PIECE_RESTITUTION. Returns false (and changes nothing) if they are
 * already separating.
 */
export function resolvePieceHit(a: Piece, b: Piece, cfg: Config): boolean {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const dist = Math.sqrt(dx * dx + dy * dy);
  if (dist === 0) return false;
  const nx = dx / dist;
  const ny = dy / dist;
  const closing = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
  if (closing >= 0) return false;
  const j = (-(1 + cfg.PIECE_RESTITUTION) * closing) / (1 / a.m + 1 / b.m);
  a.vx -= (j / a.m) * nx;
  a.vy -= (j / a.m) * ny;
  b.vx += (j / b.m) * nx;
  b.vy += (j / b.m) * ny;
  return true;
}

/** NODI-1 when a moving piece first touches a fixed rock, within maxT. */
export function timeToRockHit(p: Piece, rock: Circle, maxT: number): number {
  return sweptTime(rock.x - p.x, rock.y - p.y, -p.vx, -p.vy, p.r + rock.r, maxT);
}

/**
 * NODI-1 bounce a touching piece off a rock: the same impulse as a hit on a
 * piece of infinite mass, with the table's rock restitution.
 */
export function resolveRockHit(p: Piece, rock: Circle, table: Table): boolean {
  const dx = rock.x - p.x;
  const dy = rock.y - p.y;
  const dist = Math.sqrt(dx * dx + dy * dy);
  if (dist === 0) return false;
  const nx = dx / dist;
  const ny = dy / dist;
  const closing = -(p.vx * nx + p.vy * ny);
  if (closing >= 0) return false;
  const j = -(1 + table.rockRestitution) * closing;
  p.vx -= j * nx;
  p.vy -= j * ny;
  return true;
}
