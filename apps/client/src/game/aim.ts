import { config, type Vec } from '@carrom/engine';
import { AIM_CANCEL_RADIUS, AIM_EDGE_EPS, AIM_MAX_DRAG } from '@/constants/view';

export interface Aim { dirX: number; dirY: number; power: number; cancelled: boolean }

/**
 * Slingshot aim from a screen drag (pointer minus press point, px) seen from
 * the shooter's own view (shooter at the bottom). The shot goes opposite the
 * drag. Result is seat-relative: dirY > 0 straight ahead, dirX > 0 right.
 */
export function aimFromDrag(dragPx: Vec, boardPx: number): Aim {
  const len = Math.sqrt(dragPx.x * dragPx.x + dragPx.y * dragPx.y);
  if (len === 0 || len < AIM_CANCEL_RADIUS * boardPx) {
    return { dirX: 0, dirY: 1, power: 0, cancelled: true };
  }
  // Screen y points down (toward the shooter), so pulling down aims ahead.
  let dirX = -dragPx.x / len;
  let dirY = dragPx.y / len;
  // Only clamp when the engine has an aim limit (MIN_AIM_FORWARD -1 = any direction).
  const minY = config.MIN_AIM_FORWARD + AIM_EDGE_EPS;
  if (config.MIN_AIM_FORWARD > -1 && dirY < minY) {
    dirY = minY;
    dirX = (dirX < 0 ? -1 : 1) * Math.sqrt(1 - minY * minY);
  }
  const raw = len / (AIM_MAX_DRAG * boardPx);
  const power = Math.min(config.MAX_POWER, Math.max(config.MIN_POWER, raw));
  return { dirX, dirY, power, cancelled: false };
}
