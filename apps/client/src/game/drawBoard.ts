import { FillGradient, type Graphics } from 'pixi.js';
import { baselinePoint, config, pocketCentre, seatForward, type PocketId, type Seat } from '@carrom/engine';
import {
  ARROW_FROM, ARROW_HEAD, ARROW_TO, CENTRE_CIRCLE_COINS, FRAME_BEVEL, FRAME_WIDTH,
  LINE_WIDTH, MAX_CANVAS_PX, MIN_CANVAS_PX,
} from '@/constants/view';
import type { BoardPalette } from './skins';
import { worldToPx, worldToScreen } from './view';

const SEATS: readonly Seat[] = [0, 1, 2, 3];
const POCKETS: readonly PocketId[] = [0, 1, 2, 3];
const DIAGONALS: readonly (readonly [number, number])[] = [[1, 1], [1, -1], [-1, 1], [-1, -1]];

/** Pixel sizes for one canvas. Board drawing origin is the inner board's top-left. */
export interface BoardLayout {
  canvasPx: number;
  boardPx: number;
  framePx: number;
}

/** Fit a square board (inner + frames) into `availPx`, capped at MAX_CANVAS_PX. */
export function layoutFor(availPx: number): BoardLayout {
  const canvasPx = Math.max(MIN_CANVAS_PX, Math.floor(Math.min(availPx, MAX_CANVAS_PX)));
  const boardPx = canvasPx / (1 + 2 * FRAME_WIDTH);
  return { canvasPx, boardPx, framePx: worldToPx(FRAME_WIDTH, boardPx) };
}

interface Fills { surface: FillGradient; pocket: FillGradient }
const fillCache = new WeakMap<BoardPalette, Fills>();

/** Gradients are built once per palette (local 0–1 space) and reused for every redraw. */
function fills(C: BoardPalette): Fills {
  const hit = fillCache.get(C);
  if (hit) return hit;
  const surface = new FillGradient({
    type: 'radial',
    center: { x: 0.5, y: 0.5 }, innerRadius: 0,
    outerCenter: { x: 0.5, y: 0.5 }, outerRadius: 0.72,
    colorStops: [
      { offset: 0, color: C.surfaceGlow },
      { offset: 0.55, color: C.surface },
      { offset: 1, color: C.surfaceEdge },
    ],
  });
  const pocket = new FillGradient({
    type: 'radial',
    center: { x: 0.5, y: 0.5 }, innerRadius: 0,
    outerCenter: { x: 0.5, y: 0.5 }, outerRadius: 0.5,
    colorStops: [
      { offset: 0, color: C.pocket },
      { offset: 0.75, color: C.pocket },
      { offset: 1, color: C.pocketRim },
    ],
  });
  const out = { surface, pocket };
  fillCache.set(C, out);
  return out;
}

/** Draw the static board: frames, surface, pockets, baselines, arrows, centre circle. COS-6 colours from `C`. */
export function drawBoard(g: Graphics, layout: BoardLayout, viewSeat: Seat, C: BoardPalette): void {
  const { boardPx, framePx } = layout;
  const px = (len: number) => worldToPx(len, boardPx);
  const at = (x: number, y: number) => worldToScreen({ x, y }, viewSeat, boardPx);
  const line = px(LINE_WIDTH);
  const { surface, pocket } = fills(C);
  g.clear();

  // Wooden frame with a lighter bevel toward the playing surface.
  const outer = boardPx + 2 * framePx;
  const bevel = framePx * FRAME_BEVEL;
  g.rect(-framePx, -framePx, outer, outer).fill(C.frame)
    .stroke({ width: line * 2, color: C.frameEdge, alignment: 1 });
  g.rect(-bevel, -bevel, boardPx + 2 * bevel, boardPx + 2 * bevel).fill(C.frameLight);
  g.rect(0, 0, boardPx, boardPx).fill(surface)
    .stroke({ width: line, color: C.frameEdge });

  // Both baselines per side, closed by a green-centred circle at each end.
  const half = config.STRIKER_D / 2;
  SEATS.forEach((seat) => {
    const f = seatForward(seat);
    [-half, half].forEach((off) => {
      const a = baselinePoint(seat, -config.BASELINE_HALF);
      const b = baselinePoint(seat, config.BASELINE_HALF);
      const p = at(a.x + f.x * off, a.y + f.y * off);
      const q = at(b.x + f.x * off, b.y + f.y * off);
      g.moveTo(p.x, p.y).lineTo(q.x, q.y);
    });
    g.stroke({ width: line, color: C.line });
    [-config.BASELINE_HALF, config.BASELINE_HALF].forEach((along) => {
      const c = baselinePoint(seat, along);
      const s = at(c.x, c.y);
      g.circle(s.x, s.y, px(half)).stroke({ width: line, color: C.line });
      g.circle(s.x, s.y, px(half) * 0.62).fill(C.accent);
    });
  });

  // Diagonal arrows pointing at each pocket.
  DIAGONALS.forEach(([dx, dy]) => {
    const k = Math.SQRT1_2;
    const from = at(dx * k * ARROW_TO, dy * k * ARROW_TO);
    const to = at(dx * k * ARROW_FROM, dy * k * ARROW_FROM);
    g.moveTo(from.x, from.y).lineTo(to.x, to.y);
    const ux = (to.x - from.x) / Math.hypot(to.x - from.x, to.y - from.y);
    const uy = (to.y - from.y) / Math.hypot(to.x - from.x, to.y - from.y);
    const h = px(ARROW_HEAD);
    g.moveTo(to.x - ux * h - uy * h * 0.6, to.y - uy * h + ux * h * 0.6).lineTo(to.x, to.y)
      .lineTo(to.x - ux * h + uy * h * 0.6, to.y - uy * h - ux * h * 0.6);
    g.circle(from.x, from.y, line * 1.6);
  });
  g.stroke({ width: line, color: C.line });

  // Centre: an outer ring with a thin green band, and a small spot under the queen.
  const c = at(0, 0);
  const ring = px(CENTRE_CIRCLE_COINS * config.COIN_D);
  g.circle(c.x, c.y, ring).stroke({ width: line, color: C.line });
  g.circle(c.x, c.y, ring - line * 3).stroke({ width: line * 1.5, color: C.accent });
  g.circle(c.x, c.y, px(config.COIN_D * 0.6)).stroke({ width: line, color: C.accent });

  POCKETS.forEach((k) => {
    const pc = pocketCentre(k, config);
    const s = at(pc.x, pc.y);
    g.circle(s.x, s.y, px(config.POCKET_D / 2)).fill(pocket);
  });
}
