import { describe, expect, test } from 'vitest';
import type { ShotEvent } from '@carrom/engine';
import { applyShot, newGame, teamOf, type GameState } from '@carrom/rules';
import { WEIGHTS } from './config';
import { scoreShot } from './score';

/** Score a hand-made shot where these coins dropped. */
function shoot(s: GameState, ids: string[]): number {
  const final = { pieces: s.board.pieces.map((p) => ({ ...p, pocketed: p.pocketed || ids.includes(p.id) })) };
  const events: ShotEvent[] = ids.map((id, i) => ({ t: i, type: 'pocket', id, pocket: 0 }));
  const out = applyShot(s, events, final);
  return scoreShot(s, out.state, out.events);
}

const g = newGame({ preset: 'colour', format: '1v1', length: { kind: 'board' }, seed: 1 });
const team = teamOf(g.turnSeat, '1v1');
const own = g.teamColour[team] === 'white' ? 'w' : 'b';
const opp = own === 'w' ? 'b' : 'w';

describe('scoreShot', () => {
  test('BOT-3 own coin beats a miss; an opponent coin is worse than a miss', () => {
    const miss = shoot(g, []);
    expect(shoot(g, [`${own}1`])).toBeGreaterThan(miss + 50);
    expect(shoot(g, [`${opp}1`])).toBeLessThan(miss);
  });

  test('BOT-3 early red returns and scores below a miss', () => {
    expect(shoot(g, ['red'])).toBeLessThan(shoot(g, []));
  });

  test('BOT-3 red covered in the same shot beats the coin alone', () => {
    expect(shoot(g, [`${own}1`, 'red'])).toBeGreaterThan(shoot(g, [`${own}1`]));
  });

  test('BOT-3 winning the board outweighs everything', () => {
    const ids = [1, 2, 3, 4, 5, 6, 7, 8].map((i) => `${own}${i}`);
    const almost: GameState = {
      ...g,
      board: { pieces: g.board.pieces.map((p) => ({ ...p, pocketed: ids.includes(p.id) || p.id === 'red' })) },
      pocketed: { ...g.pocketed, [team]: [...ids, 'red'] },
    };
    expect(shoot(almost, [`${own}9`])).toBeGreaterThanOrEqual(WEIGHTS.BOARD_WON);
  });
});
