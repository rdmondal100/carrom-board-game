import type { Graphics } from 'pixi.js';
import { config, seatToWorld, type Seat, type Vec } from '@carrom/engine';
import {
  AIM_DOT_GAP, AIM_MAX_DRAG, AIM_RING_DASHES, BOARD_COLOURS, GUIDE_MAX_LEN, LINE_WIDTH, POWER_COLOURS,
} from '@/constants/view';
import type { Aim } from './aim';
import { worldToPx, worldToScreen } from './view';

const TAU = Math.PI * 2;

const mix = (a: number, b: number, t: number): number => {
  const ch = (sh: number) => Math.round(((a >> sh) & 255) + (((b >> sh) & 255) - ((a >> sh) & 255)) * t);
  return (ch(16) << 16) | (ch(8) << 8) | ch(0);
};

/** Power 0–1 → green, through amber, to red. */
export function powerColour(power: number): number {
  const p = Math.max(0, Math.min(1, power));
  return p < 0.5 ? mix(POWER_COLOURS.low, POWER_COLOURS.mid, p * 2) : mix(POWER_COLOURS.mid, POWER_COLOURS.high, (p - 0.5) * 2);
}

/** A dashed circle (Pixi has no dash style). */
function dashedRing(g: Graphics, x: number, y: number, r: number, width: number, color: number, alpha: number): void {
  const step = TAU / AIM_RING_DASHES;
  for (let i = 0; i < AIM_RING_DASHES; i++) {
    const a0 = i * step;
    g.moveTo(x + Math.cos(a0) * r, y + Math.sin(a0) * r).arc(x, y, r, a0, a0 + step * 0.55);
  }
  g.stroke({ width, color, alpha });
}

/**
 * The striking-power pointer. A dashed ring round the striker shows how far it is
 * pulled back (its size is the power, its colour goes green → red); an arrow from
 * the striker points where the shot goes, as long as the ring; white dots carry
 * the line on across the board, longer for a harder shot.
 */
export function drawAim(
  g: Graphics, from: Vec, aim: Aim | null, pullPx: Vec | null, seat: Seat, viewSeat: Seat, boardPx: number,
): void {
  g.clear();
  if (!aim || !pullPx) return;
  const s = worldToScreen(from, viewSeat, boardPx);
  const line = worldToPx(LINE_WIDTH, boardPx);
  const pull = Math.min(Math.hypot(pullPx.x, pullPx.y), AIM_MAX_DRAG * boardPx);
  const strikerR = worldToPx(config.STRIKER_D / 2, boardPx);
  if (aim.cancelled) {
    dashedRing(g, s.x, s.y, Math.max(pull, strikerR * 1.2), line, BOARD_COLOURS.guide, 0.5);
    return;
  }
  const colour = powerColour(aim.power);
  const ringR = Math.max(pull, strikerR * 1.3);
  g.circle(s.x, s.y, ringR).fill({ color: colour, alpha: 0.1 });
  dashedRing(g, s.x, s.y, ringR, line * 1.4, colour, 0.95);

  // Shot direction on screen.
  const dir = seatToWorld(seat, aim.dirX, aim.dirY);
  const far = worldToScreen({ x: from.x + dir.x, y: from.y + dir.y }, viewSeat, boardPx);
  const len = Math.hypot(far.x - s.x, far.y - s.y);
  const ux = (far.x - s.x) / len;
  const uy = (far.y - s.y) / len;

  // Arrow: from the striker's edge to the ring, with a dark outline so it reads on any board.
  const head = Math.max(strikerR * 0.7, line * 6);
  const tipX = s.x + ux * ringR;
  const tipY = s.y + uy * ringR;
  const baseX = tipX - ux * head;
  const baseY = tipY - uy * head;
  const startX = s.x + ux * strikerR * 0.6;
  const startY = s.y + uy * strikerR * 0.6;
  const headPts = [tipX, tipY, baseX - uy * head * 0.55, baseY + ux * head * 0.55, baseX + uy * head * 0.55, baseY - ux * head * 0.55];
  g.moveTo(startX, startY).lineTo(baseX, baseY).stroke({ width: line * 4.2, color: 0x000000, alpha: 0.35, cap: 'round' });
  g.moveTo(startX, startY).lineTo(baseX, baseY).stroke({ width: line * 2.6, color: colour, cap: 'round' });
  g.poly(headPts).fill(colour).stroke({ width: line * 0.8, color: 0x000000, alpha: 0.35 });

  // Guide dots beyond the arrow, fading out.
  const dotsLen = worldToPx(GUIDE_MAX_LEN * aim.power, boardPx);
  const gap = worldToPx(AIM_DOT_GAP, boardPx);
  const dotR = Math.max(1.2, line * 1.1);
  for (let d = gap; d <= dotsLen; d += gap) {
    const fade = 1 - d / (dotsLen + gap);
    g.circle(tipX + ux * d, tipY + uy * d, dotR * (0.6 + 0.4 * fade)).fill({ color: BOARD_COLOURS.guide, alpha: 0.95 * fade });
  }
}
