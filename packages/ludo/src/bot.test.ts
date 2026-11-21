import { describe, expect, it } from 'vitest';
import { ludoBot } from './bot';
import { DEFAULT_LUDO_CONFIG, ludoModule as m } from './module';
import { playOut } from './playOut';

const GAMES = 100;
const MAX_BOT_MS = 50;

describe('ludo bot', () => {
  it(`LUDO-5 hard beats easy in ≥ 70 % of ${GAMES} seeded 1v1 games`, () => {
    let hardWins = 0;
    for (let g = 0; g < GAMES; g++) {
      // Swap seats every game so neither side always rolls first.
      const hardSeat = g % 2 === 0 ? 0 : 2;
      const easySeat = 2 - hardSeat;
      const last = playOut(DEFAULT_LUDO_CONFIG, 1000 + g, { [hardSeat]: 'hard', [easySeat]: 'easy' }).at(-1)!;
      if (m.result(last)?.winner === String(hardSeat)) hardWins++;
    }
    console.log(`LUDO-5 hard won ${hardWins} / ${GAMES}`);
    expect(hardWins).toBeGreaterThanOrEqual(GAMES * 0.7);
  });

  it(`LUDO-5 a hard move takes < ${MAX_BOT_MS} ms (4 players)`, () => {
    const states = playOut({ ...DEFAULT_LUDO_CONFIG, players: 4 }, 77, {});
    let worst = 0;
    for (const s of states.filter((x) => x.phase === 'move' && x.winner === null)) {
      const t0 = performance.now();
      ludoBot(s, s.turnSeat, 'hard', 1);
      worst = Math.max(worst, performance.now() - t0);
    }
    expect(worst).toBeLessThan(MAX_BOT_MS);
  });

  it('LUDO-5 the bot rolls when it must and always picks a legal token', () => {
    const tap = m.newGame({ ...DEFAULT_LUDO_CONFIG, tapToRoll: true }, 4);
    expect(ludoBot(tap, tap.turnSeat, 'hard', 1)).toEqual({ roll: true });
    for (const level of ['easy', 'medium', 'hard'] as const) {
      expect(m.result(playOut({ ...DEFAULT_LUDO_CONFIG, players: 4, teams: true }, 5, { 0: level, 1: level, 2: level, 3: level }).at(-1)!)).not.toBeNull();
    }
  });
});
