import { describe, expect, it } from 'vitest';
import { config } from './config';
import { pocketCentre } from './pockets';
import { createRack } from './rack';
import { isAtRest, step } from './step';
import type { BoardState, Piece } from './types';

const coin = (id: string, x: number, y: number, vx = 0, vy = 0): Piece => ({
  id, kind: 'white', x, y, vx, vy, r: config.COIN_D / 2, m: config.COIN_MASS, pocketed: false,
});

describe('step', () => {
  it('never changes its input', () => {
    const state: BoardState = { pieces: [coin('a', 0, 0, 1, 0)] };
    const before = JSON.stringify(state);
    const out = step(state, 0);
    expect(JSON.stringify(state)).toBe(before);
    expect(out.state.pieces[0]?.x).toBeGreaterThan(0);
  });

  it('moves and slows a piece by FRICTION_DECEL', () => {
    const { state } = step({ pieces: [coin('a', 0, 0, 1, 0)] }, 0);
    const p = state.pieces[0] as Piece;
    expect(p.x).toBeCloseTo(config.DT, 12);
    expect(p.vx).toBeCloseTo(1 - config.FRICTION_DECEL * config.DT, 12);
  });

  it('stops a piece below REST_SPEED', () => {
    const { state } = step({ pieces: [coin('a', 0, 0, config.REST_SPEED, 0)] }, 0);
    expect(isAtRest(state)).toBe(true);
  });

  it('reports a hit and a frame bounce with times in ms', () => {
    const a = coin('a', 0.5 - config.COIN_D / 2 - 0.001, 0, 1, 0);
    const { events } = step({ pieces: [a] }, 100);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ type: 'frame', id: 'a' });
    expect(events[0]?.t).toBeCloseTo(101, 9);
  });

  it('drops a coin already inside a rim at the start of the step', () => {
    const c = pocketCentre(2, config);
    const { state, events } = step({ pieces: [coin('a', c.x, c.y)] }, 0);
    expect(state.pieces[0]?.pocketed).toBe(true);
    expect(events).toEqual([{ t: 0, type: 'pocket', id: 'a', pocket: 2 }]);
  });

  it('the striker bounces out of a corner instead of dropping', () => {
    const rack = createRack(0);
    const striker = { ...(rack.pieces.at(-1) as Piece), x: 0.3, y: 0.3, vx: 3, vy: 3 };
    let state: BoardState = { pieces: [striker] };
    const events = [];
    for (let i = 0; i < 120; i++) {
      const out = step(state, i);
      state = out.state;
      events.push(...out.events);
    }
    expect(events.filter((e) => e.type === 'pocket')).toHaveLength(0);
    expect(events.filter((e) => e.type === 'frame').length).toBeGreaterThanOrEqual(2);
    const s = state.pieces[0] as Piece;
    expect(s.pocketed).toBe(false);
    expect(Math.abs(s.x)).toBeLessThanOrEqual(0.5 - s.r + 1e-12);
    expect(Math.abs(s.y)).toBeLessThanOrEqual(0.5 - s.r + 1e-12);
  });
});
