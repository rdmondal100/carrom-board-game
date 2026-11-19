import { describe, expect, it } from 'vitest';
import { config } from './config';
import { createRack, placeStriker } from './rack';
import { baselinePoint, seatOutward } from './seats';
import type { BoardState, Piece, Seat } from './types';

const SEATS: Seat[] = [0, 1, 2, 3];
const d = config.COIN_D;
const dist = (a: { x: number; y: number }, b: { x: number; y: number }) =>
  Math.hypot(a.x - b.x, a.y - b.y);

describe('rack layout', () => {
  it('has 9 white, 9 black, 1 red and a striker', () => {
    const { pieces } = createRack(0);
    const count = (k: string) => pieces.filter((p) => p.kind === k).length;
    expect(count('white')).toBe(9);
    expect(count('black')).toBe(9);
    expect(count('red')).toBe(1);
    expect(count('striker')).toBe(1);
    expect(new Set(pieces.map((p) => p.id)).size).toBe(pieces.length);
  });

  it('puts red on centre with 6 coins touching it', () => {
    const { pieces } = createRack(0);
    const red = pieces.find((p) => p.kind === 'red') as Piece;
    expect(red.x).toBe(0);
    expect(red.y).toBe(0);
    const touching = pieces.filter((p) => p !== red && Math.abs(dist(p, red) - d) < 1e-12);
    expect(touching).toHaveLength(6);
    const whites = touching.filter((p) => p.kind === 'white').length;
    expect(whites).toBe(3);
  });

  it('outer ring: whites at 2d, blacks at √3·d', () => {
    const { pieces } = createRack(0);
    const coins = pieces.filter((p) => p.kind !== 'striker' && p.kind !== 'red');
    const at = (r: number) => coins.filter((p) => Math.abs(dist(p, { x: 0, y: 0 }) - r) < 1e-12);
    expect(at(2 * d).every((p) => p.kind === 'white')).toBe(true);
    expect(at(2 * d)).toHaveLength(6);
    expect(at(Math.sqrt(3) * d).every((p) => p.kind === 'black')).toBe(true);
    expect(at(Math.sqrt(3) * d)).toHaveLength(6);
  });

  it('no two pieces overlap', () => {
    const { pieces } = createRack(0);
    for (let i = 0; i < pieces.length; i++) {
      for (let j = i + 1; j < pieces.length; j++) {
        const a = pieces[i] as Piece;
        const b = pieces[j] as Piece;
        expect(dist(a, b)).toBeGreaterThan(a.r + b.r - 1e-12);
      }
    }
  });

  it.each(SEATS)('a white points at breaking seat %i, striker on its baseline', (seat) => {
    const { pieces } = createRack(seat);
    const o = seatOutward(seat);
    const front = { x: o.x * 2 * d, y: o.y * 2 * d };
    const coin = pieces.find((p) => dist(p, front) < 1e-12);
    expect(coin?.kind).toBe('white');
    const striker = pieces.find((p) => p.kind === 'striker') as Piece;
    expect(dist(striker, baselinePoint(seat, 0))).toBeLessThan(1e-12);
  });
});

describe('placeStriker', () => {
  const lone = (coins: Piece[] = []): BoardState => ({
    pieces: [...coins, { ...createRack(0).pieces.at(-1)! }],
  });
  const coinAt = (x: number, y: number, id = 'c'): Piece => ({
    id, kind: 'white', x, y, vx: 0, vy: 0, r: d / 2, m: 1, pocketed: false,
  });

  it('keeps a free spot as asked', () => {
    expect(placeStriker(lone(), 0, 0.1)).toEqual({ ok: true, x: 0.1 });
  });

  it('clamps to the baseline ends', () => {
    expect(placeStriker(lone(), 0, 0.9).x).toBe(config.BASELINE_HALF);
    expect(placeStriker(lone(), 0, -0.9).x).toBe(-config.BASELINE_HALF);
  });

  it('slides off a coin on the baseline to the nearest touching spot', () => {
    // Seat 0 baseline is y = 0.34, its right is -x. A coin at world x = -0.05
    // sits at along = +0.05.
    const y = config.HALF_L - config.BASELINE_INSET;
    const state = lone([coinAt(-0.05, y)]);
    const res = placeStriker(state, 0, 0.06);
    const reach = (config.STRIKER_D + d) / 2;
    expect(res.ok).toBe(true);
    expect(res.x).toBeCloseTo(0.05 + reach, 8);
    const p = baselinePoint(0, res.x);
    expect(dist(p, { x: -0.05, y })).toBeGreaterThanOrEqual(reach);
  });

  it('ignores pocketed coins', () => {
    const y = config.HALF_L - config.BASELINE_INSET;
    const state = lone([{ ...coinAt(0, y), pocketed: true }]);
    expect(placeStriker(state, 0, 0)).toEqual({ ok: true, x: 0 });
  });

  it('reports no spot when the whole baseline is blocked', () => {
    const y = config.HALF_L - config.BASELINE_INSET;
    const coins: Piece[] = [];
    for (let i = 0; i <= 14; i++) coins.push(coinAt(-0.28 + i * 0.04, y, `c${i}`));
    expect(placeStriker(lone(coins), 0, 0).ok).toBe(false);
  });
});
