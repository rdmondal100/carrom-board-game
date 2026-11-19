import { describe, expect, it } from 'vitest';
import { config } from './config';
import { placeCoin } from './place';
import { createRack } from './rack';
import type { BoardState, Piece } from './types';

const pocket = (state: BoardState, id: string): BoardState => ({
  pieces: state.pieces.map((p) => (p.id === id ? { ...p, pocketed: true, x: 0.47, y: 0.47 } : p)),
});

describe('placeCoin (RUL-8 helper)', () => {
  it('puts a coin on the centre spot when it is free', () => {
    const rack = createRack(0);
    const empty: BoardState = { pieces: rack.pieces.map((p) => ({ ...p, pocketed: p.id !== 'striker' })) };
    const out = placeCoin(empty, 'red');
    expect(out.pieces.find((p) => p.id === 'red')).toMatchObject({ x: 0, y: 0, pocketed: false });
  });

  it('uses the nearest free point when the centre is taken, without overlap', () => {
    const rack = pocket(createRack(0), 'w1');
    const out = placeCoin(rack, 'w1');
    const coin = out.pieces.find((p) => p.id === 'w1') as Piece;
    expect(coin.pocketed).toBe(false);
    for (const o of out.pieces) {
      if (o === coin || o.pocketed) continue;
      expect(Math.hypot(o.x - coin.x, o.y - coin.y)).toBeGreaterThanOrEqual(o.r + coin.r - 1e-9);
    }
    // The rack is 2.5 d across, so the nearest free point is close to it.
    expect(Math.hypot(coin.x, coin.y)).toBeLessThan(4 * config.COIN_D);
  });

  it('never changes its input and gives the same spot every time', () => {
    const rack = pocket(createRack(1), 'b3');
    const before = JSON.stringify(rack);
    const a = placeCoin(rack, 'b3');
    const b = placeCoin(rack, 'b3');
    expect(JSON.stringify(rack)).toBe(before);
    expect(a).toEqual(b);
  });

  it('throws for an unknown id', () => {
    expect(() => placeCoin(createRack(0), 'nope')).toThrow(RangeError);
  });
});
