import { describe, expect, it } from 'vitest';
import { config, type Seat } from '@carrom/engine';
import { aimFor, newCtrl } from './boardCtrl';
import { planeToPx, pxToPlane, toPlane } from './boardPlane';
import { screenToWorld, worldToScreen } from './view';

const SEATS: readonly Seat[] = [0, 1, 2, 3];
const POINTS = [{ x: 0, y: 0 }, { x: 0.31, y: -0.12 }, { x: -0.44, y: 0.4 }, { x: 0.2, y: 0.45 }];
const BOARD_PX = 517;

describe('3D board plane', () => {
  it('T3D-4 a spot on the 3D board is the same board px as on the 2D board, for every view seat', () => {
    for (const view of SEATS) {
      for (const p of POINTS) {
        const plane = toPlane(p, view);
        const px3d = planeToPx(plane.x, plane.z, BOARD_PX);
        const px2d = worldToScreen(p, view, BOARD_PX);
        expect(px3d.x).toBeCloseTo(px2d.x, 9);
        expect(px3d.y).toBeCloseTo(px2d.y, 9);
        const back = screenToWorld(px3d, view, BOARD_PX);
        expect(back.x).toBeCloseTo(p.x, 9);
        expect(back.y).toBeCloseTo(p.y, 9);
        const round = pxToPlane(px3d, BOARD_PX);
        expect(round.x).toBeCloseTo(plane.x, 9);
        expect(round.z).toBeCloseTo(plane.z, 9);
      }
    }
  });

  it('T3D-4 the board centre is the plane origin; the inner board spans ±HALF_L', () => {
    for (const view of SEATS) {
      const near = toPlane({ x: 0, y: 0 }, view);
      expect(near.x).toBeCloseTo(0, 9);
      expect(near.z).toBeCloseTo(0, 9);
    }
    const corner = planeToPx(-config.HALF_L, -config.HALF_L, BOARD_PX);
    expect(corner).toEqual({ x: 0, y: 0 });
  });

  it('T3D-4 the same drag on the 3D plane gives the same aim as in 2D', () => {
    for (const view of SEATS) {
      const c = { ...newCtrl(view), view };
      c.layout = { ...c.layout, boardPx: BOARD_PX };
      // A finger pulled from (0.05, 0.2) to (−0.1, 0.38) on the board, measured on each view.
      const a2 = worldToScreen({ x: 0.05, y: 0.2 }, view, BOARD_PX);
      const b2 = worldToScreen({ x: -0.1, y: 0.38 }, view, BOARD_PX);
      const pa = toPlane({ x: 0.05, y: 0.2 }, view);
      const pb = toPlane({ x: -0.1, y: 0.38 }, view);
      const a3 = planeToPx(pa.x, pa.z, BOARD_PX);
      const b3 = planeToPx(pb.x, pb.z, BOARD_PX);
      const aim2 = aimFor(c, { x: b2.x - a2.x, y: b2.y - a2.y });
      const aim3 = aimFor(c, { x: b3.x - a3.x, y: b3.y - a3.y });
      expect(aim3.dirX).toBeCloseTo(aim2.dirX, 9);
      expect(aim3.dirY).toBeCloseTo(aim2.dirY, 9);
      expect(aim3.power).toBeCloseTo(aim2.power, 9);
    }
  });
});
