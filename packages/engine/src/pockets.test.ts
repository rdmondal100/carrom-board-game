import { describe, expect, it } from 'vitest';
import { config } from './config';
import { POCKET_IDS, dropInPocket, insidePocket, pocketCentre, timeToPocket } from './pockets';
import type { Piece } from './types';

const piece = (kind: Piece['kind'], x: number, y: number, vx = 0, vy = 0): Piece => ({
  id: kind, kind, x, y, vx, vy,
  r: (kind === 'striker' ? config.STRIKER_D : config.COIN_D) / 2,
  m: 1, pocketed: false,
});

describe('pockets', () => {
  it('each pocket touches both of its frames', () => {
    const rim = config.POCKET_D / 2;
    POCKET_IDS.forEach((k) => {
      const c = pocketCentre(k, config);
      expect(config.HALF_L - Math.abs(c.x)).toBeCloseTo(rim, 12);
      expect(config.HALF_L - Math.abs(c.y)).toBeCloseTo(rim, 12);
    });
  });

  it('pocket k sits between seat k and seat k+1', () => {
    expect(pocketCentre(0, config)).toMatchObject({ x: expect.any(Number) });
    expect(Math.sign(pocketCentre(0, config).x)).toBe(-1);
    expect(Math.sign(pocketCentre(0, config).y)).toBe(1);
    expect(Math.sign(pocketCentre(2, config).x)).toBe(1);
    expect(Math.sign(pocketCentre(2, config).y)).toBe(-1);
  });

  it('is too small for two coins side by side', () => {
    expect(config.POCKET_D).toBeLessThan(2 * config.COIN_D);
  });

  it('times a coin crossing the rim', () => {
    const c = pocketCentre(3, config);
    const rim = config.POCKET_D / 2;
    const p = piece('white', c.x - rim - 0.1, c.y, 1, 0);
    const hit = timeToPocket(p, 1, config);
    expect(hit.pocket).toBe(3);
    expect(hit.t).toBeCloseTo(0.1, 12);
  });

  it('never pockets the striker', () => {
    const c = pocketCentre(3, config);
    const s = piece('striker', c.x - 0.1, c.y, 1, 0);
    expect(timeToPocket(s, 1, config).t).toBe(Infinity);
    expect(insidePocket({ ...s, x: c.x, y: c.y }, config)).toBeNull();
  });

  it('drop takes the coin off the board and stops it', () => {
    const p = piece('black', 0, 0, 1, 1);
    dropInPocket(p, 1, config);
    expect(p).toMatchObject({ pocketed: true, vx: 0, vy: 0, ...pocketCentre(1, config) });
  });
});
