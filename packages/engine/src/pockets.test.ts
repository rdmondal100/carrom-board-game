import { describe, expect, it } from 'vitest';
import { config, TABLES } from './config';
import {
  POCKET_IDS, bounceOffPocket, bouncesOut, dropInPocket, insidePocket, pocketCentre, timeToPocket,
} from './pockets';
import type { Piece } from './types';

const T = TABLES.carrom;

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
    const hit = timeToPocket(p, 1, T);
    expect(hit.pocket).toBe(3);
    expect(hit.t).toBeCloseTo(0.1, 12);
  });

  it('never pockets the striker', () => {
    const c = pocketCentre(3, config);
    const s = piece('striker', c.x - 0.1, c.y, 1, 0);
    expect(timeToPocket(s, 1, T).t).toBe(Infinity);
    expect(insidePocket({ ...s, x: c.x, y: c.y }, T)).toBeNull();
  });

  it('a coin above POCKET_MAX_DROP_SPEED bounces out; at or below it drops', () => {
    const v = config.POCKET_MAX_DROP_SPEED;
    expect(bouncesOut(piece('white', 0, 0, v, 0), T)).toBe(false);
    expect(bouncesOut(piece('white', 0, 0, v + 0.01, 0), T)).toBe(true);
  });

  it('a head-on bounce comes straight back at POCKET_RESTITUTION of the speed, outside the rim', () => {
    const c = pocketCentre(3, config);
    const rim = config.POCKET_D / 2;
    const p = piece('white', c.x - rim, c.y, 5, 0);
    bounceOffPocket(p, 3, T, config);
    expect(p.vx).toBeCloseTo(-5 * config.POCKET_RESTITUTION, 12);
    expect(p.vy).toBeCloseTo(0, 12);
    expect(Math.hypot(p.x - c.x, p.y - c.y)).toBeGreaterThan(rim);
    expect(insidePocket(p, T)).toBeNull();
  });

  it('drop takes the coin off the board and stops it', () => {
    const p = piece('black', 0, 0, 1, 1);
    dropInPocket(p, 1, T);
    expect(p).toMatchObject({ pocketed: true, vx: 0, vy: 0, ...pocketCentre(1, config) });
  });
});

describe('NODI-1 tables', () => {
  it('TABLES.carrom pockets are exactly pocketCentre(k)', () => {
    POCKET_IDS.forEach((k) => expect(T.pockets[k]).toEqual(pocketCentre(k, config)));
  });

  it('a boat drops into a whirlpool; a whirlpool fits one boat at a time', () => {
    const W = TABLES.nodiPar;
    const c = W.pockets[1]!;
    const b: Piece = { id: 'b', kind: 'boat', x: c.x - 0.1, y: c.y, vx: 1, vy: 0, r: 0.03, m: 1, pocketed: false };
    expect(timeToPocket(b, 1, W)).toMatchObject({ pocket: 1 });
    expect(insidePocket({ ...b, x: c.x, y: c.y }, W)).toBe(1);
    expect(W.pocketD).toBeLessThan(2 * 0.06);
  });
});
