import { describe, expect, it } from 'vitest';
import { baselinePoint, type Seat } from '@carrom/engine';
import { screenToWorld, worldToScreen } from './view';

const SEATS: Seat[] = [0, 1, 2, 3];
const PX = 360;

describe('view', () => {
  it('BRD-2 world→screen→world round-trips for all 4 view seats', () => {
    const points = [
      { x: 0, y: 0 }, { x: 0.3, y: -0.2 }, { x: -0.49, y: 0.41 }, { x: 0.123, y: 0.456 },
    ];
    SEATS.forEach((seat) => {
      points.forEach((p) => {
        const back = screenToWorld(worldToScreen(p, seat, PX), seat, PX);
        expect(back.x).toBeCloseTo(p.x, 12);
        expect(back.y).toBeCloseTo(p.y, 12);
      });
    });
  });

  it('BRD-2 the view seat sits at the bottom centre, its right on screen right', () => {
    SEATS.forEach((seat) => {
      const base = worldToScreen(baselinePoint(seat, 0), seat, PX);
      expect(base.x).toBeCloseTo(PX / 2, 9);
      expect(base.y).toBeGreaterThan(PX * 0.6);
      const right = worldToScreen(baselinePoint(seat, 0.2), seat, PX);
      expect(right.x).toBeGreaterThan(base.x);
      expect(right.y).toBeCloseTo(base.y, 9);
    });
  });

  it('BRD-2 centre maps to the middle of the screen', () => {
    SEATS.forEach((seat) => {
      const c = worldToScreen({ x: 0, y: 0 }, seat, PX);
      expect(c.x).toBeCloseTo(PX / 2, 12);
      expect(c.y).toBeCloseTo(PX / 2, 12);
    });
  });
});
