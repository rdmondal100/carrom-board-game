import { config, seatForward, seatRight, type Seat, type Vec } from '@carrom/engine';

// Screen space: origin at the inner board's top-left corner, x right, y down,
// boardPx pixels per board side L. viewSeat sits at the bottom of the screen:
// its right is screen +x, its forward (toward the centre) is screen up.

/** World point → screen pixels. */
export function worldToScreen(p: Vec, viewSeat: Seat, boardPx: number): Vec {
  const r = seatRight(viewSeat);
  const f = seatForward(viewSeat);
  const scale = boardPx / config.L;
  const u = p.x * r.x + p.y * r.y;
  const w = p.x * f.x + p.y * f.y;
  return { x: (u + config.HALF_L) * scale, y: (config.HALF_L - w) * scale };
}

/** Screen pixels → world point. */
export function screenToWorld(p: Vec, viewSeat: Seat, boardPx: number): Vec {
  const r = seatRight(viewSeat);
  const f = seatForward(viewSeat);
  const scale = boardPx / config.L;
  const u = p.x / scale - config.HALF_L;
  const w = config.HALF_L - p.y / scale;
  return { x: u * r.x + w * f.x, y: u * r.y + w * f.y };
}

/** World length → pixels. */
export function worldToPx(len: number, boardPx: number): number {
  return (len * boardPx) / config.L;
}
