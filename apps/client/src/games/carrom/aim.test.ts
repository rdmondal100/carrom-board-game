import { describe, expect, it } from 'vitest';
import { config } from '@carrom/engine';
import { AIM_CANCEL_RADIUS, AIM_MAX_DRAG } from '@/constants/view';
import { aimFromDrag } from './aim';

const PX = 400;

describe('aim', () => {
  it('BRD-4 drag straight down = aim straight ahead', () => {
    const a = aimFromDrag({ x: 0, y: 80 }, PX);
    expect(a.cancelled).toBe(false);
    expect(a.dirX).toBeCloseTo(0, 12);
    expect(a.dirY).toBeCloseTo(1, 12);
  });

  it('BRD-4 drag down-left aims ahead-right (opposite the drag)', () => {
    const a = aimFromDrag({ x: -50, y: 50 }, PX);
    expect(a.dirX).toBeGreaterThan(0);
    expect(a.dirY).toBeGreaterThan(0);
    expect(a.dirX * a.dirX + a.dirY * a.dirY).toBeCloseTo(1, 12);
  });

  it('BRD-4 power = drag / AIM_MAX_DRAG, clamped MIN_POWER..1', () => {
    const full = AIM_MAX_DRAG * PX;
    expect(aimFromDrag({ x: 0, y: full / 2 }, PX).power).toBeCloseTo(0.5, 12);
    expect(aimFromDrag({ x: 0, y: full * 3 }, PX).power).toBe(1);
    // The shortest drag that doesn't cancel still lands inside MIN_POWER..1.
    const tiny = aimFromDrag({ x: 0, y: AIM_CANCEL_RADIUS * PX + 0.5 }, PX);
    expect(tiny.power).toBeGreaterThanOrEqual(config.MIN_POWER);
    expect(tiny.power).toBeCloseTo((AIM_CANCEL_RADIUS * PX + 0.5) / full, 12);
  });

  it('BRD-4 any direction: pulling up (toward the board) aims back at the own frame', () => {
    expect(config.MIN_AIM_FORWARD).toBe(-1);
    const back = aimFromDrag({ x: 0, y: -100 }, PX);
    expect(back.cancelled).toBe(false);
    expect(back.dirX).toBeCloseTo(0, 12);
    expect(back.dirY).toBeCloseTo(-1, 12);
    const side = aimFromDrag({ x: 100, y: 0 }, PX);
    expect(side.dirX).toBeCloseTo(-1, 12);
    expect(side.dirY).toBeCloseTo(0, 12);
    const backRight = aimFromDrag({ x: -60, y: -80 }, PX);
    expect(backRight.dirX).toBeCloseTo(0.6, 12);
    expect(backRight.dirY).toBeCloseTo(-0.8, 12);
  });

  it('BRD-4 releasing inside AIM_CANCEL_RADIUS cancels', () => {
    const r = AIM_CANCEL_RADIUS * PX;
    expect(aimFromDrag({ x: 0, y: 0 }, PX).cancelled).toBe(true);
    expect(aimFromDrag({ x: r * 0.6, y: r * 0.6 }, PX).cancelled).toBe(true);
    expect(aimFromDrag({ x: 0, y: r * 1.01 }, PX).cancelled).toBe(false);
  });
});
