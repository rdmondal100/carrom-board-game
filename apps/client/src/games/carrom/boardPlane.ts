import { config, type Seat, type Vec } from '@carrom/engine';
import { worldToScreen } from './view';

/**
 * T3D-4 the 3D board lies on the plane y = 0 exactly as the 2D board lies on the
 * screen: x right, z toward the viewer (screen down), 1 unit = L, the inner
 * board centred on the origin, `view` at the near edge.
 */
export function toPlane(p: Vec, view: Seat): { x: number; z: number } {
  const s = worldToScreen(p, view, config.L);
  return { x: s.x - config.HALF_L, z: s.y - config.HALF_L };
}

/** A point on the 3D board plane as board px: the same px the 2D board gives for that spot. */
export function planeToPx(x: number, z: number, boardPx: number): Vec {
  const k = boardPx / config.L;
  return { x: (x + config.HALF_L) * k, y: (z + config.HALF_L) * k };
}

/** Board px back to the plane (the pull line). */
export function pxToPlane(p: Vec, boardPx: number): { x: number; z: number } {
  const k = config.L / boardPx;
  return { x: p.x * k - config.HALF_L, z: p.y * k - config.HALF_L };
}
