import { describe, expect, test } from 'vitest';
import { placeStriker } from '@carrom/engine';
import { newGame, teamOf, type GameState } from '@carrom/rules';
import { candidates, targetCoins } from './candidates';
import { LEVELS } from './config';
import { randomMidGame } from './testkit';

const g = newGame({ preset: 'colour', format: '1v1', length: { kind: 'board' }, seed: 1 });
const team = teamOf(g.turnSeat, '1v1');
const colour = g.teamColour[team] as string;
const mine = g.board.pieces.filter((p) => p.kind === colour).map((p) => p.id);

/** g with these own coins already down. */
function withDown(ids: string[]): GameState {
  return {
    ...g,
    board: { pieces: g.board.pieces.map((p) => (ids.includes(p.id) ? { ...p, pocketed: true } : p)) },
    pocketed: { ...g.pocketed, [team]: ids },
  };
}

describe('targetCoins', () => {
  test('BOT-3 colour game aims only at own colour, red not before a coin is down', () => {
    const kinds = new Set(targetCoins(g).map((p) => p.kind));
    expect([...kinds]).toEqual([colour]);
  });

  test('BOT-3 red becomes a target once the side has a coin down', () => {
    expect(targetCoins(withDown(mine.slice(0, 1))).some((p) => p.kind === 'red')).toBe(true);
  });

  test('BOT-3 RUL-7 last own coin is not a target while red is on the board', () => {
    expect(targetCoins(withDown(mine.slice(0, 8))).map((p) => p.kind)).toEqual(['red']);
  });

  test('BOT-3 point game aims at any coin', () => {
    const p = newGame({ preset: 'point', format: '2v2', length: { kind: 'points', target: 300 }, seed: 3 });
    const kinds = new Set(targetCoins(p).map((c) => c.kind));
    expect(kinds.has('white') && kinds.has('black')).toBe(true);
  });
});

describe('candidates', () => {
  test('BOT-3 never more than the level allows, every spot placeable', () => {
    for (let seed = 0; seed < 10; seed++) {
      const s = randomMidGame(seed, seed % 2 ? 'colour' : 'point', seed % 3 ? '1v1' : '2v2');
      for (const level of Object.values(LEVELS)) {
        const list = candidates(s, level);
        expect(list.length).toBeGreaterThan(0);
        expect(list.length).toBeLessThanOrEqual(level.sims);
        for (const c of list) {
          expect(c.input.seat).toBe(s.turnSeat);
          expect(placeStriker(s.board, c.input.seat, c.input.x)).toEqual({ ok: true, x: c.input.x });
        }
      }
    }
  });
});
