import type { RatingChange } from '@carrom/protocol';
import { teamOf, type Format, type Team } from '@carrom/rules';
import { Match, type MatchDoc } from '../models/match.model.js';
import { isDuplicateKey, User } from '../models/user.model.js';
import { eloUpdate } from '../utils/elo.js';

export interface ResultPlayer { userId: string; name: string; seat: number }

export interface MatchResult {
  /** Unique per game (room id + game number): the same id is written once. */
  matchId: string;
  ranked: boolean;
  format: Format;
  winner: Team;
  boards: number;
  /** RANK-4 the loser left and did not come back. */
  abandoned: boolean;
  players: ResultPlayer[];
}

const changesOf = (m: MatchDoc): RatingChange[] => m.players.map((p) => ({
  seat: p.seat, userId: String(p.userId), ratingBefore: p.ratingBefore, ratingAfter: p.ratingAfter,
}));

/** RANK-1: new ratings by user id. Only a ranked 1v1 changes them. */
function newRatings(r: MatchResult, before: Map<string, number>): Map<string, number> {
  const after = new Map(before);
  if (!r.ranked || r.format !== '1v1' || r.players.length !== 2) return after;
  const [a, b] = r.players as [ResultPlayer, ResultPlayer];
  const score = teamOf(a.seat, r.format) === r.winner ? 1 : 0;
  const [na, nb] = eloUpdate(before.get(a.userId) ?? 0, before.get(b.userId) ?? 0, score);
  after.set(a.userId, na);
  after.set(b.userId, nb);
  return after;
}

/**
 * RANK-4 / RANK-5: write the Match and apply rating changes exactly once.
 * The unique `matchId` index is the guard: only the call whose insert wins
 * changes ratings; a repeat (or a racing call) gets the stored result back.
 */
export async function recordMatch(r: MatchResult): Promise<RatingChange[]> {
  const existing = await Match.findOne({ matchId: r.matchId });
  if (existing) return changesOf(existing);

  const users = await User.find({ _id: { $in: r.players.map((p) => p.userId) } }, { rating: 1 });
  const before = new Map(users.map((u) => [u.id as string, u.rating]));
  const after = newRatings(r, before);
  let doc: MatchDoc;
  try {
    doc = await Match.create({
      matchId: r.matchId, ranked: r.ranked, winner: r.winner, boards: r.boards, abandoned: r.abandoned,
      players: r.players.map((p) => ({
        userId: p.userId, name: p.name, seat: p.seat, team: teamOf(p.seat, r.format),
        ratingBefore: before.get(p.userId) ?? 0, ratingAfter: after.get(p.userId) ?? 0,
      })),
    });
  } catch (err) {
    if (!isDuplicateKey(err)) throw err;
    const won = await Match.findOne({ matchId: r.matchId });
    if (!won) throw err;
    return changesOf(won);
  }
  if (r.ranked) {
    await Promise.all(doc.players.map((p) => User.updateOne(
      { _id: p.userId },
      { $inc: { rating: p.ratingAfter - p.ratingBefore, rankedGames: 1 } },
    )));
  }
  return changesOf(doc);
}
