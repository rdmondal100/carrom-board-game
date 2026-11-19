import type { Piece, ShotEvent } from '@carrom/engine';
import { describe, expect, it } from 'vitest';
import { applyShot, applyTimeout } from './game';
import { W, game, play, shoot } from './testkit';

describe('game', () => {
  it('RUL-3 the break alternates sides each board', () => {
    const script = [['w1'], ['red'], ['w2'], W.slice(2)];
    const g1 = game('colour', '1v1', { kind: 'points', target: 29 }, 0);
    const g2 = play(g1, script).state;
    expect([g2.boardNo, g2.breakSeat, g2.turnSeat]).toEqual([2, 2, 2]);
    expect(g2.teamColour).toEqual({ A: 'black', B: 'white' });

    // 2 v 2: seat 3 (team B) breaks and plays white; board 2 goes to seat 0, team A.
    const t1 = game('colour', '2v2', { kind: 'points', target: 29 }, 3);
    expect(t1.teamColour).toEqual({ A: 'black', B: 'white' });
    const t2 = play(t1, script).state;
    expect([t2.boardNo, t2.breakSeat]).toEqual([2, 0]);
    expect(t2.teamColour).toEqual({ A: 'white', B: 'black' });
  });

  it('RUL-8 returned coins go on the centre spot or the nearest free point', () => {
    const { state } = play(game('colour'), [W.slice(0, 8), ['w9']]);
    const w9 = state.board.pieces.find((p) => p.id === 'w9') as Piece;
    expect(w9.pocketed).toBe(false);
    for (const o of state.board.pieces) {
      if (o === w9 || o.pocketed) continue;
      expect(Math.hypot(o.x - w9.x, o.y - w9.y)).toBeGreaterThanOrEqual(o.r + w9.r - 1e-9);
    }
    const early = shoot(game('colour'), ['red']).state;
    expect(early.board.pieces.find((p) => p.id === 'red')).toMatchObject({ x: 0, y: 0 });
  });

  it('RUL-9 no striker penalty: a miss takes nothing back', () => {
    const g = play(game('colour'), [['w1'], ['b1']]).state;
    const final = { pieces: g.board.pieces.map((p) => ({ ...p })) };
    const strikerDrop: ShotEvent = { t: 0, type: 'pocket', id: 'striker', pocket: 1 };
    const { state, events } = applyShot(g, [strikerDrop], final);
    expect(events).toEqual([{ type: 'turn', seat: 0 }]);
    expect(state.pocketed).toEqual(g.pocketed);
  });

  it('RUL-10 shot clock expiry passes the turn; two in a row hand the seat to a bot', () => {
    const g = game('colour', '2v2', { kind: 'board' }, 0);
    const t1 = applyTimeout(g);
    expect(t1.events).toEqual([{ type: 'turn', seat: 1 }]);
    const back = play(t1.state, [[], [], []]).state;
    expect(back.turnSeat).toBe(0);
    const t2 = applyTimeout(back);
    expect(t2.events).toContainEqual({ type: 'botTakeover', seat: 0 });
    expect(t2.state.timeouts[0]).toBe(2);
  });

  it('RUL-10 a shot in between resets the timeout count', () => {
    const g = game('colour');
    const t1 = applyTimeout(g).state; // seat 0 times out
    const t2 = shoot(t1, []).state; // seat 2 misses
    const t3 = shoot(t2, []).state; // seat 0 shoots: count resets
    const t4 = shoot(t3, []).state; // seat 2 misses
    const t5 = applyTimeout(t4);
    expect(t5.events.some((e) => e.type === 'botTakeover')).toBe(false);
  });

  it('a timeout while red waits for cover returns red', () => {
    const mid = play(game('colour'), [['w1'], ['red']]).state;
    const { state, events } = applyTimeout(mid);
    expect(events).toContainEqual({ type: 'returned', id: 'red', reason: 'red not covered' });
    expect(state.redPending).toBeNull();
  });

  it('2 v 2 turn order and team scoring', () => {
    const g = game('point', '2v2', { kind: 'board' }, 0);
    const seats: number[] = [];
    let s = g;
    for (let i = 0; i < 5; i++) {
      seats.push(s.turnSeat);
      s = shoot(s, []).state;
    }
    expect(seats).toEqual([0, 1, 2, 3, 0]);
    // Seat 0 pockets w1, misses; seat 1 misses; seat 2 pockets w2; seat 2 misses;
    // seat 3 pockets b1. Seats 0 and 2 both score for team A.
    const { state } = play(g, [['w1'], [], [], ['w2'], [], ['b1']]);
    expect(state.pocketed).toEqual({ A: ['w1', 'w2'], B: ['b1'] });
  });

  it('1 v 1 uses seats 0 and 2', () => {
    let s = game('colour', '1v1');
    const seats = new Set<number>();
    for (let i = 0; i < 6; i++) {
      seats.add(s.turnSeat);
      s = shoot(s, []).state;
    }
    expect([...seats].sort()).toEqual([0, 2]);
  });

  it('rejects shots after the game is over', () => {
    const done = play(game('colour'), [['w1'], ['red'], ['w2'], W.slice(2)]).state;
    expect(done.winner).toBe('A');
    expect(() => shoot(done, [])).toThrow();
  });
});
