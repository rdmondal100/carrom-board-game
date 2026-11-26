import { FRAME_WIDTH, MAX_BOARD_TEX_PX, MAX_CANVAS_PX, MIN_CANVAS_PX } from '@/constants/view';
import { paintFrame, paintRailShadow, paintSurface, type Ground } from './boardArt';
import type { BoardFinish, BoardPalette } from './skins';
import { worldToPx } from './view';

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

/** The 2D surface ground for a board finish (marble and gloss boards are plain colour in 2D). */
export const groundFor = (finish: BoardFinish): Ground => (finish.surface === 'wood' ? 'wood' : 'plain');

/**
 * The static board (frame, surface, markings, pockets) painted at `scale` device
 * pixels per layout px, origin at the frame's outer top-left. COS-6 colours from `C`.
 * The board looks the same from every side, so it does not depend on the view seat.
 */
export function paintBoardCanvas(layout: BoardLayout, C: BoardPalette, finish: BoardFinish, scale: number): HTMLCanvasElement {
  const k = Math.min(scale, MAX_BOARD_TEX_PX / layout.canvasPx);
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = Math.round(layout.canvasPx * k);
  const ctx = canvas.getContext('2d')!;
  ctx.scale(k, k);
  paintFrame(ctx, layout.boardPx, layout.framePx, C);
  ctx.save();
  ctx.translate(layout.framePx, layout.framePx);
  ctx.beginPath();
  ctx.rect(0, 0, layout.boardPx, layout.boardPx);
  ctx.clip();
  paintSurface(ctx, layout.boardPx, C, groundFor(finish));
  ctx.restore();
  paintRailShadow(ctx, layout.boardPx, layout.framePx, C);
  return canvas;
}
