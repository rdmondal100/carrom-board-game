import { describe, expect, it } from 'vitest';
import { DEFAULT_NODI_CONFIG, NodiConfigSchema, NodiMoveSchema, nodiParModule as m } from './module';
import { playOut } from './playOut';

describe('NODI-2 module', () => {
  it('NODI-2 schemas take launch and flick moves and the two table sizes only', () => {
    expect(NodiConfigSchema.safeParse({ players: 4, borsha: true }).success).toBe(true);
    expect(NodiConfigSchema.safeParse({ players: 3, borsha: false }).success).toBe(false);
    expect(NodiMoveSchema.safeParse({ kind: 'launch', x: 0.1, dirX: 0, dirY: 1, power: 0.4 }).success).toBe(true);
    expect(NodiMoveSchema.safeParse({ kind: 'flick', boat: 6, dirX: 0, dirY: 1, power: 0.4 }).success).toBe(false);
    expect(NodiMoveSchema.safeParse({ kind: 'flick', boat: 2, dirX: Number.NaN, dirY: 1, power: 0.4 }).success).toBe(false);
  });

  it('NODI-2 seats, teams, a seeded first player and rematch with the next seat', () => {
    expect(m.seats(DEFAULT_NODI_CONFIG)).toEqual([0, 2]);
    expect(m.seats({ players: 4, borsha: false }).map((q) => m.teamOf({ players: 4, borsha: false }, q))).toEqual(['A', 'B', 'A', 'B']);
    expect(new Set(Array.from({ length: 20 }, (_, i) => m.newGame(DEFAULT_NODI_CONFIG, i).first))).toEqual(new Set([0, 2]));
    const s = m.newGame(DEFAULT_NODI_CONFIG, 3);
    expect(m.rematch(s).first).toBe(s.first === 0 ? 2 : 0);
  });

  it('NODI-2 a whole match is replayable: same seed, same hashes; result and rounds', () => {
    const a = playOut(DEFAULT_NODI_CONFIG, 21, { 0: 'medium', 2: 'easy' });
    const b = playOut(DEFAULT_NODI_CONFIG, 21, { 0: 'medium', 2: 'easy' });
    expect(a.map(m.hash)).toEqual(b.map(m.hash));
    const last = a.at(-1)!;
    const res = m.result(last)!;
    expect(res.placings).toEqual(m.seats(last.config).map((q) => (m.teamOf(last.config, q) === res.winner ? 1 : 2)));
    expect(m.rounds(last)).toBeGreaterThanOrEqual(2);
    expect(m.applyMove(last, last.turnSeat, last.turnId, { kind: 'launch', x: 0, dirX: 0, dirY: 1, power: 0.3 })).toMatchObject({ code: 'GAME_OVER' });
  });
});
