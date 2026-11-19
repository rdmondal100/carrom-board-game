import { expect, test } from 'vitest';
import { botMatch } from './testkit';

test('BOT-4 hard beats easy in ≥ 75% of 40 one-board colour games', () => {
  let wins = 0;
  for (let seed = 0; seed < 40; seed++) {
    // Swap sides every game so the break doesn't favour one level.
    const hardIsA = seed % 2 === 0;
    const r = hardIsA ? botMatch(seed, 'hard', 'easy') : botMatch(seed, 'easy', 'hard');
    if (r.winner === (hardIsA ? 'A' : 'B')) wins++;
  }
  expect(wins).toBeGreaterThanOrEqual(30);
}, 600_000);
