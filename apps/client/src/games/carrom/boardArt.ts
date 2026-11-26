// A real carrom board painted on a 2D canvas: lacquered plywood with grain, the
// printed markings of a tournament board, netted pockets and a mitred hardwood
// frame. Shared by the 2D board (as a Pixi texture) and the 3D board texture.
// Looks only: nothing here reaches the engine.
import { baselinePoint, config, pocketCentre, seatForward, type PocketId, type Seat } from '@carrom/engine';
import { ARROW_FROM, ARROW_HEAD, ARROW_TO, CENTRE_CIRCLE_COINS, LINE_WIDTH } from '@/constants/view';
import { paintWood, type WoodOptions } from '@/game3d/three/wood';
import type { BoardPalette } from './skins';
import { worldToScreen } from './view';

const SEATS: readonly Seat[] = [0, 1, 2, 3];
const POCKETS: readonly PocketId[] = [0, 1, 2, 3];
const DIAGONALS: readonly (readonly [number, number])[] = [[1, 1], [1, -1], [-1, 1], [-1, -1]];
const TAU = Math.PI * 2;
/** Generated wood is made once at this size and scaled. */
const WOOD_PX = 512;
/** Rosette petals in the centre design. */
const PETALS = 8;
/** Net mesh cells across a pocket. */
const NET_CELLS = 7;

const css = (c: number, a = 1): string =>
  `rgba(${(c >> 16) & 255}, ${(c >> 8) & 255}, ${c & 255}, ${a})`;

const woodCache = new Map<string, HTMLCanvasElement>();
/** A square of generated wood (grain left to right), cached by colour and options. */
function woodSquare(base: number, o: WoodOptions): HTMLCanvasElement {
  const key = `${base}:${JSON.stringify(o)}`;
  let c = woodCache.get(key);
  if (!c) {
    c = document.createElement('canvas');
    c.width = c.height = WOOD_PX;
    paintWood(c.getContext('2d')!, WOOD_PX, base, o);
    woodCache.set(key, c);
  }
  return c;
}

export type Ground = 'wood' | 'plain' | ((ctx: CanvasRenderingContext2D, s: number) => void);

/**
 * The playing surface, `s` px square with its origin at the inner top-left:
 * the ground (wood, plain or a given painter), a lacquer sheen, the markings and the pockets.
 */
export function paintSurface(ctx: CanvasRenderingContext2D, s: number, C: BoardPalette, ground: Ground): void {
  const at = (x: number, y: number) => worldToScreen({ x, y }, 0, s);
  const px = (len: number) => (len * s) / config.L;
  const line = Math.max(1, px(LINE_WIDTH) * 1.3);

  if (ground === 'wood') {
    ctx.drawImage(woodSquare(C.surface, { rings: 11, warp: 2.4, contrast: 0.13, fibre: 0.8, seed: 13 }), 0, 0, s, s);
  } else if (ground === 'plain') {
    ctx.fillStyle = css(C.surface);
    ctx.fillRect(0, 0, s, s);
  } else ground(ctx, s);

  // Lamp light in the middle, darker toward the rails.
  const glow = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s * 0.75);
  glow.addColorStop(0, css(C.surfaceGlow, 0.45));
  glow.addColorStop(0.55, css(C.surface, 0));
  glow.addColorStop(1, css(C.surfaceEdge, 0.55));
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, s, s);

  paintMarkings(ctx, C, line, at, px);
  POCKETS.forEach((k) => {
    const pc = at(pocketCentre(k, config).x, pocketCentre(k, config).y);
    paintPocket(ctx, pc.x, pc.y, px(config.POCKET_D / 2), C);
  });

  // Lacquer: a broad soft reflection from the top-left.
  const sheen = ctx.createLinearGradient(0, 0, s, s);
  sheen.addColorStop(0, 'rgba(255,255,255,0.10)');
  sheen.addColorStop(0.45, 'rgba(255,255,255,0)');
  sheen.addColorStop(1, 'rgba(0,0,0,0.06)');
  ctx.fillStyle = sheen;
  ctx.fillRect(0, 0, s, s);
}

type At = (x: number, y: number) => { x: number; y: number };

function ring(ctx: CanvasRenderingContext2D, x: number, y: number, r: number): void {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
}

function paintMarkings(
  ctx: CanvasRenderingContext2D, C: BoardPalette, line: number, at: At, px: (l: number) => number,
): void {
  ctx.lineCap = 'round';
  ctx.strokeStyle = css(C.line, 0.9);
  ctx.lineWidth = line;
  const half = config.STRIKER_D / 2;

  // Base lines: two printed lines per side closed by red-centred circles.
  for (const seat of SEATS) {
    const f = seatForward(seat);
    for (const off of [-half, half]) {
      const a = baselinePoint(seat, -config.BASELINE_HALF);
      const b = baselinePoint(seat, config.BASELINE_HALF);
      const p = at(a.x + f.x * off, a.y + f.y * off);
      const q = at(b.x + f.x * off, b.y + f.y * off);
      ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(q.x, q.y); ctx.stroke();
    }
    for (const along of [-config.BASELINE_HALF, config.BASELINE_HALF]) {
      const bp = baselinePoint(seat, along);
      const c = at(bp.x, bp.y);
      ring(ctx, c.x, c.y, px(half)); ctx.stroke();
      ctx.fillStyle = css(C.accent);
      ring(ctx, c.x, c.y, px(half) * 0.7); ctx.fill();
      ctx.strokeStyle = css(C.line, 0.5);
      ring(ctx, c.x, c.y, px(half) * 0.7); ctx.stroke();
      ctx.strokeStyle = css(C.line, 0.9);
    }
  }

  // Foul lines: an arrow toward each pocket, ending in a half-moon near the middle.
  for (const [dx, dy] of DIAGONALS) {
    const k = Math.SQRT1_2;
    const from = at(dx * k * ARROW_TO, dy * k * ARROW_TO);
    const to = at(dx * k * ARROW_FROM, dy * k * ARROW_FROM);
    const len = Math.hypot(to.x - from.x, to.y - from.y);
    const ux = (to.x - from.x) / len;
    const uy = (to.y - from.y) / len;
    const h = px(ARROW_HEAD);
    ctx.beginPath();
    ctx.moveTo(from.x, from.y); ctx.lineTo(to.x, to.y);
    ctx.moveTo(to.x - ux * h - uy * h * 0.55, to.y - uy * h + ux * h * 0.55);
    ctx.lineTo(to.x, to.y);
    ctx.lineTo(to.x - ux * h + uy * h * 0.55, to.y - uy * h - ux * h * 0.55);
    ctx.stroke();
    const dir = Math.atan2(uy, ux);
    const moon = px(ARROW_HEAD) * 1.3;
    ctx.beginPath(); ctx.arc(from.x + ux * moon, from.y + uy * moon, moon, dir + Math.PI * 0.5, dir + Math.PI * 1.5); ctx.stroke();
  }

  // Centre: double ring, an eight-petal rosette, and the queen's red spot.
  const c = at(0, 0);
  const R = px(CENTRE_CIRCLE_COINS * config.COIN_D);
  ring(ctx, c.x, c.y, R); ctx.stroke();
  ring(ctx, c.x, c.y, R - line * 3); ctx.stroke();
  const inner = px(config.COIN_D * 0.62);
  ctx.save();
  ctx.translate(c.x, c.y);
  for (let i = 0; i < PETALS; i++) {
    ctx.rotate(TAU / PETALS);
    ctx.beginPath();
    ctx.moveTo(0, -inner);
    ctx.quadraticCurveTo(R * 0.36, -R * 0.55, 0, -(R - line * 5));
    ctx.quadraticCurveTo(-R * 0.36, -R * 0.55, 0, -inner);
    ctx.fillStyle = css(C.accent, 0.16);
    ctx.fill();
    ctx.stroke();
  }
  ctx.restore();
  ctx.fillStyle = css(C.accent, 0.85);
  ring(ctx, c.x, c.y, inner); ctx.fill(); ctx.stroke();
}

/** A pocket: the cut hole, its rim, and the string net hanging below in the dark. */
function paintPocket(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, C: BoardPalette): void {
  ctx.save();
  ring(ctx, x, y, r);
  const well = ctx.createRadialGradient(x, y, 0, x, y, r);
  well.addColorStop(0, '#000');
  well.addColorStop(0.75, css(C.pocket));
  well.addColorStop(1, css(C.pocketRim));
  ctx.fillStyle = well;
  ctx.fill();
  ctx.clip();
  // Net mesh, sagging: lighter strings near the top, lost in shadow at the bottom.
  const cell = (2 * r) / NET_CELLS;
  ctx.lineWidth = Math.max(0.6, r * 0.045);
  ctx.strokeStyle = 'rgba(235,225,205,0.28)';
  ctx.beginPath();
  for (let i = -NET_CELLS; i <= NET_CELLS; i++) {
    const o = i * cell;
    ctx.moveTo(x - r + o, y - r); ctx.lineTo(x + r + o, y + r);
    ctx.moveTo(x + r + o, y - r); ctx.lineTo(x - r + o, y + r);
  }
  ctx.stroke();
  const depth = ctx.createRadialGradient(x + r * 0.15, y + r * 0.15, 0, x, y, r);
  depth.addColorStop(0, 'rgba(0,0,0,0.75)');
  depth.addColorStop(0.6, 'rgba(0,0,0,0.25)');
  depth.addColorStop(1, 'rgba(0,0,0,0.6)');
  ctx.fillStyle = depth;
  ctx.fillRect(x - r, y - r, 2 * r, 2 * r);
  ctx.restore();
  // Cut edge: shadow on the lit side's inner wall, a bright lip on the far side.
  ctx.lineWidth = Math.max(1, r * 0.09);
  ctx.strokeStyle = 'rgba(0,0,0,0.55)';
  ctx.beginPath(); ctx.arc(x, y, r, Math.PI * 0.9, Math.PI * 1.6); ctx.stroke();
  ctx.strokeStyle = 'rgba(255,240,215,0.35)';
  ctx.beginPath(); ctx.arc(x, y, r, -Math.PI * 0.1, Math.PI * 0.6); ctx.stroke();
}

/**
 * The hardwood frame around an inner board of `boardPx`, drawn on a canvas whose
 * origin is the frame's outer top-left: four mitred rails with grain along their
 * length, rounded outer corners, and the shadow the rails cast on the surface.
 */
export function paintFrame(ctx: CanvasRenderingContext2D, boardPx: number, framePx: number, C: BoardPalette): void {
  const outer = boardPx + 2 * framePx;
  const corner = framePx * 0.35;
  const grain = woodSquare(C.frame, { rings: 14, warp: 1.8, contrast: 0.5, fibre: 0.7, seed: 5 });
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(0, 0, outer, outer, corner);
  ctx.clip();
  ctx.fillStyle = css(C.frame);
  ctx.fillRect(0, 0, outer, outer);
  // Rail k: 0 top, 1 right, 2 bottom, 3 left. Each is the top rail turned k quarter turns.
  for (let k = 0; k < 4; k++) {
    ctx.save();
    ctx.translate(outer / 2, outer / 2);
    ctx.rotate((k * Math.PI) / 2);
    ctx.translate(-outer / 2, -outer / 2);
    ctx.beginPath();
    ctx.moveTo(0, 0); ctx.lineTo(outer, 0); ctx.lineTo(outer - framePx, framePx); ctx.lineTo(framePx, framePx);
    ctx.closePath();
    ctx.clip();
    ctx.drawImage(grain, 0, (k * WOOD_PX) / 4, WOOD_PX, WOOD_PX / 4, 0, 0, outer, framePx);
    // Rounded rail: light along the outer edge, darker toward the board.
    const shade = ctx.createLinearGradient(0, 0, 0, framePx);
    shade.addColorStop(0, 'rgba(255,255,255,0.10)');
    shade.addColorStop(0.15, 'rgba(255,255,255,0.22)');
    shade.addColorStop(0.5, 'rgba(0,0,0,0)');
    shade.addColorStop(1, 'rgba(0,0,0,0.30)');
    ctx.fillStyle = shade;
    ctx.fillRect(0, 0, outer, framePx);
    // The mitre joints.
    ctx.strokeStyle = 'rgba(0,0,0,0.45)';
    ctx.lineWidth = Math.max(1, framePx * 0.03);
    ctx.beginPath();
    ctx.moveTo(0, 0); ctx.lineTo(framePx, framePx);
    ctx.moveTo(outer, 0); ctx.lineTo(outer - framePx, framePx);
    ctx.stroke();
    // Light falls from the top-left: the top and left rails are brighter.
    ctx.fillStyle = k === 0 || k === 3 ? 'rgba(255,240,220,0.06)' : 'rgba(0,0,0,0.12)';
    ctx.fillRect(0, 0, outer, framePx);
    ctx.restore();
  }
  ctx.restore();
  ctx.lineWidth = Math.max(1, framePx * 0.05);
  ctx.strokeStyle = css(C.frameEdge);
  ctx.beginPath(); ctx.roundRect(ctx.lineWidth / 2, ctx.lineWidth / 2, outer - ctx.lineWidth, outer - ctx.lineWidth, corner); ctx.stroke();
}

/** The rails' cast shadow and the cushion lip, over a surface already drawn at (framePx, framePx). */
export function paintRailShadow(ctx: CanvasRenderingContext2D, boardPx: number, framePx: number, C: BoardPalette): void {
  const depth = framePx * 0.28;
  for (let k = 0; k < 4; k++) {
    const outer = boardPx + 2 * framePx;
    ctx.save();
    ctx.translate(outer / 2, outer / 2);
    ctx.rotate((k * Math.PI) / 2);
    ctx.translate(-outer / 2, -outer / 2);
    const g = ctx.createLinearGradient(0, framePx, 0, framePx + depth);
    g.addColorStop(0, `rgba(0,0,0,${k === 0 || k === 3 ? 0.38 : 0.2})`);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(framePx, framePx, boardPx, depth);
    ctx.fillStyle = css(C.frameLight, 0.9);
    ctx.fillRect(framePx, framePx - Math.max(1, framePx * 0.05), boardPx, Math.max(1, framePx * 0.05));
    ctx.restore();
  }
}
