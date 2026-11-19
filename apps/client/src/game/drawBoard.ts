import type { Graphics } from 'pixi.js';
import { baselinePoint, config, pocketCentre, seatForward, type PocketId, type Seat } from '@carrom/engine';
import {
  BOARD_COLOURS, MIN_CANVAS_PX, CENTRE_CIRCLE_COINS, FRAME_WIDTH, LINE_WIDTH, MAX_CANVAS_PX,
} from '@/constants/view';
import { worldToPx, worldToScreen } from './view';

const SEATS: readonly Seat[] = [0, 1, 2, 3];
const POCKETS: readonly PocketId[] = [0, 1, 2, 3];

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

/** Draw the static board: frames, surface, pockets, baselines, centre circle. */
export function drawBoard(g: Graphics, layout: BoardLayout, viewSeat: Seat): void {
  const { boardPx, framePx } = layout;
  const px = (len: number) => worldToPx(len, boardPx);
  const at = (x: number, y: number) => worldToScreen({ x, y }, viewSeat, boardPx);
  const line = px(LINE_WIDTH);
  g.clear();

  g.rect(-framePx, -framePx, boardPx + 2 * framePx, boardPx + 2 * framePx)
    .fill(BOARD_COLOURS.frame)
    .stroke({ width: line * 2, color: BOARD_COLOURS.frameEdge, alignment: 1 });
  g.rect(0, 0, boardPx, boardPx).fill(BOARD_COLOURS.surface)
    .stroke({ width: line, color: BOARD_COLOURS.frameEdge });

  // Both baselines per side, with a circle closing each end.
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
    g.stroke({ width: line, color: BOARD_COLOURS.line });
    [-config.BASELINE_HALF, config.BASELINE_HALF].forEach((along) => {
      const c = baselinePoint(seat, along);
      const s = at(c.x, c.y);
      g.circle(s.x, s.y, px(half)).stroke({ width: line, color: BOARD_COLOURS.line });
      g.circle(s.x, s.y, px(half) * 0.7).fill(BOARD_COLOURS.red);
    });
  });

  const c = at(0, 0);
  g.circle(c.x, c.y, px(CENTRE_CIRCLE_COINS * config.COIN_D))
    .stroke({ width: line, color: BOARD_COLOURS.line });
  g.circle(c.x, c.y, px(config.COIN_D * 0.6)).stroke({ width: line, color: BOARD_COLOURS.line });

  POCKETS.forEach((k) => {
    const pc = pocketCentre(k, config);
    const s = at(pc.x, pc.y);
    g.circle(s.x, s.y, px(config.POCKET_D / 2)).fill(BOARD_COLOURS.pocket);
  });
}
