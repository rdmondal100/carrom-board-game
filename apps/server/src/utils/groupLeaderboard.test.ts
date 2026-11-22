import { describe, expect, it } from 'vitest';
import type { PlayerSummary } from '@carrom/protocol';
import { groupLeaderboard, type LeaderMatch } from './groupLeaderboard.js';

const members = new Map<string, PlayerSummary>([
  ['a', { id: 'a', name: 'Anik', avatar: 0 }],
  ['b', { id: 'b', name: 'Bina', avatar: 1 }],
  ['c', { id: 'c', name: 'Cara', avatar: 2 }],
]);
const game = (winner: string, ...players: [string, string][]): LeaderMatch =>
  ({ winner, players: players.map(([userId, team]) => ({ userId, team })) });

describe('ADDA-3 group leaderboard', () => {
  it('ADDA-3 group leaderboard counts only games where ≥ 2 members played together', () => {
    const rows = groupLeaderboard([
      game('A', ['a', 'A'], ['b', 'B']), // counts: Anik wins
      game('A', ['a', 'A'], ['stranger', 'B']), // one member only: ignored
      game('B', ['c', 'A'], ['x', 'B'], ['y', 'C']), // one member only: ignored
      game('B', ['a', 'A'], ['b', 'B'], ['c', 'B']), // counts: Bina and Cara win (same team)
      game('A', ['b', 'A'], ['b', 'A']), // the same member twice is still one member: ignored
    ], members);
    // Equal wins: fewer games first, then by name.
    expect(rows).toEqual([
      { userId: 'c', name: 'Cara', avatar: 2, wins: 1, games: 1 },
      { userId: 'a', name: 'Anik', avatar: 0, wins: 1, games: 2 },
      { userId: 'b', name: 'Bina', avatar: 1, wins: 1, games: 2 },
    ]);
  });

  it('ADDA-3 former members are not counted; no games = no rows', () => {
    expect(groupLeaderboard([game('A', ['a', 'A'], ['gone', 'B'])], members)).toEqual([]);
    expect(groupLeaderboard([], members)).toEqual([]);
  });
});
