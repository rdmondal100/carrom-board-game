import { NODI } from '@carrom/engine';
import { describe, expect, it } from 'vitest';
import { nodiBot, slideDistance, speedFor } from './bot';
import { DEFAULT_NODI_CONFIG, nodiParModule as m } from './module';
import { playOut } from './playOut';
import type { NodiConfig } from './types';

const GAMES = 40;

describe('NODI-3 bot', () => {
  it(`NODI-3 hard beats easy in ≥ 70 % of ${GAMES} seeded 1v1 games`, () => {
    let hardWins = 0;
    for (let g = 0; g < GAMES; g++) {
      // Swap seats every game so neither side always moves first.
      const hardSeat = g % 2 === 0 ? 0 : 2;
      const last = playOut(DEFAULT_NODI_CONFIG, 500 + g, { [hardSeat]: 'hard', [2 - hardSeat]: 'easy' }).at(-1)!;
      if (m.result(last)?.winner === m.teamOf(DEFAULT_NODI_CONFIG, hardSeat)) hardWins++;
    }
    console.log(`NODI-3 hard won ${hardWins} / ${GAMES}`);
    expect(hardWins).toBeGreaterThanOrEqual(GAMES * 0.7);
  });

  it('NODI-3 same state, level and seed → same move; every level finishes 2v2 and Borsha games', () => {
    const s = m.newGame(DEFAULT_NODI_CONFIG, 9);
    expect(nodiBot(s, s.turnSeat, 'hard', 3)).toEqual(nodiBot(s, s.turnSeat, 'hard', 3));
    for (const c of [{ players: 4, borsha: false }, { players: 2, borsha: true }] as NodiConfig[]) {
      for (const level of ['easy', 'medium', 'hard'] as const) {
        expect(m.result(playOut(c, 5, { 0: level, 1: level, 2: level, 3: level }).at(-1)!)).not.toBeNull();
      }
    }
  });

  it('NODI-3 the power aim: a lone boat slides the distance it was aimed for', () => {
    for (const d of [0.1, 0.25, 0.5]) {
      expect(slideDistance(speedFor(d))).toBeCloseTo(d, 6);
    }
    expect(speedFor(100)).toBe(NODI.MAX_SPEED);
  });
});
