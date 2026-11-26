import type { CanvasTexture } from 'three';
import { baselinePoint, config, pocketCentre, seatForward, type PocketId, type Seat } from '@carrom/engine';
import { ARROW_FROM, ARROW_HEAD, ARROW_TO, CENTRE_CIRCLE_COINS, LINE_WIDTH } from '@/constants/view';
import type { BoardPalette, BoardFinish } from '@/games/carrom/skins';
import { worldToScreen } from '@/games/carrom/view';
import { canvasTexture, css, paintMarble } from '@/game3d/three/textures';
import { paintWood } from '@/game3d/three/wood';

const PX = 1024;
const SEATS: readonly Seat[] = [0, 1, 2, 3];
const POCKETS: readonly PocketId[] = [0, 1, 2, 3];
const DIAGONALS: readonly (readonly [number, number])[] = [[1, 1], [1, -1], [-1, 1], [-1, -1]];

/**
 * T3D-4 the playing surface as a texture: the 2D board's lines, circles, arrows
 * and pockets (the board is the same from every side, so it is painted once),
 * over wood grain or marble when the board's finish has one.
 */
export function boardTexture(C: BoardPalette, finish: BoardFinish): CanvasTexture {
  return canvasTexture(PX, (ctx, s) => {
    const at = (x: number, y: number) => worldToScreen({ x, y }, 0, s);
    const px = (len: number) => (len * s) / config.L;
    const line = px(LINE_WIDTH) * 1.4;
    if (finish.surface === 'marble') paintMarble(ctx, s, C.surface, C.accent, 21);
    else if (finish.surface === 'wood') paintWood(ctx, s, C.surface, { rings: 3, warp: 1.1, contrast: 0.1, fibre: 0.35, seed: 13 });
    else { ctx.fillStyle = css(C.surface); ctx.fillRect(0, 0, s, s); }
    // The soft light in the middle, as in 2D.
    const glow = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s * 0.72);
    glow.addColorStop(0, css(C.surfaceGlow));
    glow.addColorStop(0.55, `${css(C.surface)}00`);
    glow.addColorStop(1, css(C.surfaceEdge));
    ctx.globalAlpha = finish.surface === 'marble' ? 0.25 : 0.3;
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, s, s);
    ctx.globalAlpha = 1;

    ctx.strokeStyle = css(C.line);
    ctx.lineWidth = line;
    const half = config.STRIKER_D / 2;
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
        const c = at(baselinePoint(seat, along).x, baselinePoint(seat, along).y);
        ctx.beginPath(); ctx.arc(c.x, c.y, px(half), 0, Math.PI * 2); ctx.stroke();
        ctx.fillStyle = css(C.accent);
        ctx.beginPath(); ctx.arc(c.x, c.y, px(half) * 0.62, 0, Math.PI * 2); ctx.fill();
      }
    }
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
      ctx.moveTo(to.x - ux * h - uy * h * 0.6, to.y - uy * h + ux * h * 0.6);
      ctx.lineTo(to.x, to.y);
      ctx.lineTo(to.x - ux * h + uy * h * 0.6, to.y - uy * h - ux * h * 0.6);
      ctx.stroke();
      ctx.beginPath(); ctx.arc(from.x, from.y, line * 1.6, 0, Math.PI * 2); ctx.stroke();
    }
    const c = at(0, 0);
    const ring = px(CENTRE_CIRCLE_COINS * config.COIN_D);
    ctx.beginPath(); ctx.arc(c.x, c.y, ring, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = css(C.accent);
    ctx.lineWidth = line * 1.5;
    ctx.beginPath(); ctx.arc(c.x, c.y, ring - line * 3, 0, Math.PI * 2); ctx.stroke();
    ctx.lineWidth = line;
    ctx.beginPath(); ctx.arc(c.x, c.y, px(config.COIN_D * 0.6), 0, Math.PI * 2); ctx.stroke();

    // Pockets: a dark well with a lit rim.
    for (const k of POCKETS) {
      const pc = pocketCentre(k, config);
      const p = at(pc.x, pc.y);
      const r = px(config.POCKET_D / 2);
      const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r);
      g.addColorStop(0, '#000000');
      g.addColorStop(0.7, css(C.pocket));
      g.addColorStop(1, css(C.pocketRim));
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, Math.PI * 2); ctx.fill();
    }
  });
}
