import type { GroupLeaderRow, PlayerSummary } from '@carrom/protocol';

/** The parts of a recorded match the leaderboard reads. */
export interface LeaderMatch { winner: string; players: { userId: unknown; team: string }[] }

/**
 * ADDA-3 a group's leaderboard in one game: wins inside the group. Only games
 * where at least two current members played together count; a member's game
 * is a win when their team won. Members without a counted game are left out.
 * Order: wins, then fewer games, then name.
 */
export function groupLeaderboard(matches: readonly LeaderMatch[], members: ReadonlyMap<string, PlayerSummary>): GroupLeaderRow[] {
  const rows = new Map<string, GroupLeaderRow>();
  for (const m of matches) {
    const inGroup = m.players.filter((p) => members.has(String(p.userId)));
    if (new Set(inGroup.map((p) => String(p.userId))).size < 2) continue;
    for (const p of inGroup) {
      const id = String(p.userId);
      const who = members.get(id)!;
      const row = rows.get(id) ?? { userId: id, name: who.name, avatar: who.avatar, wins: 0, games: 0 };
      row.games += 1;
      if (p.team === m.winner) row.wins += 1;
      rows.set(id, row);
    }
  }
  return [...rows.values()].sort((a, b) => b.wins - a.wins || a.games - b.games || a.name.localeCompare(b.name));
}
