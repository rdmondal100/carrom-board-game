import { describe, expect, it } from 'vitest';
import { config } from './config';
import {
  resolveFrameHit, resolvePieceHit, sweptTime, timeToFrameHit, timeToPieceHit,
} from './collide';
import type { Piece } from './types';

const coin = (x: number, y: number, vx = 0, vy = 0, id = 'c'): Piece => ({
  id, kind: 'white', x, y, vx, vy, r: config.COIN_D / 2, m: config.COIN_MASS, pocketed: false,
});

describe('swept collision', () => {
  it('finds the contact time of an approaching point', () => {
    expect(sweptTime(-1, 0, 1, 0, 0.5, 10)).toBeCloseTo(0.5, 12);
  });

  it('ignores contact beyond maxT, misses, and separating overlap', () => {
    expect(sweptTime(-1, 0, 1, 0, 0.5, 0.4)).toBe(Infinity);
    expect(sweptTime(-1, 2, 1, 0, 0.5, 10)).toBe(Infinity);
    expect(sweptTime(0.1, 0, 1, 0, 0.5, 10)).toBe(Infinity);
  });

  it('reports 0 for overlapping pieces closing in', () => {
    expect(sweptTime(0.1, 0, -1, 0, 0.5, 10)).toBe(0);
  });

  it('catches a fast piece that would jump over another inside one step', () => {
    const a = coin(0, 0, 20, 0, 'a'); // 20 L/s moves 0.083 L per step
    const b = coin(0.06, 0, 0, 0, 'b');
    const t = timeToPieceHit(a, b, config.DT);
    expect(t).toBeCloseTo((0.06 - config.COIN_D) / 20, 12);
  });
});

describe('frame bounce', () => {
  it('finds the frame hit and reflects with FRAME_RESTITUTION', () => {
    const p = coin(0.4, 0, 1, 0);
    const hit = timeToFrameHit(p, 1, config);
    expect(hit.axis).toBe('x');
    expect(hit.t).toBeCloseTo(0.5 - p.r - 0.4, 12);
    p.x += p.vx * hit.t;
    resolveFrameHit(p, hit.axis, config);
    expect(p.vx).toBeCloseTo(-config.FRAME_RESTITUTION, 12);
    expect(p.x).toBeLessThanOrEqual(0.5 - p.r);
  });

  it('keeps the tangent speed', () => {
    const p = coin(0, 0.5 - config.COIN_D / 2, 0.3, 1);
    resolveFrameHit(p, 'y', config);
    expect(p.vx).toBe(0.3);
    expect(p.vy).toBeCloseTo(-config.FRAME_RESTITUTION, 12);
  });
});

describe('piece hit', () => {
  it('conserves momentum and applies PIECE_RESTITUTION', () => {
    const a: Piece = { ...coin(0, 0, 2, 0, 'a'), m: config.STRIKER_MASS };
    const b = coin(a.r + config.COIN_D / 2, 0, 0, 0, 'b');
    const before = a.m * a.vx + b.m * b.vx;
    expect(resolvePieceHit(a, b, config)).toBe(true);
    expect(a.m * a.vx + b.m * b.vx).toBeCloseTo(before, 12);
    expect(b.vx - a.vx).toBeCloseTo(config.PIECE_RESTITUTION * 2, 12);
  });

  it('does nothing to separating pieces', () => {
    const a = coin(0, 0, -1, 0, 'a');
    const b = coin(config.COIN_D, 0, 0, 0, 'b');
    expect(resolvePieceHit(a, b, config)).toBe(false);
    expect(a.vx).toBe(-1);
  });
});
