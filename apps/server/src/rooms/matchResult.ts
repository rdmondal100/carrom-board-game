import type { RatingChange } from '@carrom/protocol';
import { Match, type MatchDoc } from '../models/match.model.js';
import { isDuplicateKey, ratingOf, START_RATING, User } from '../models/user.model.js';
import { eloUpdate } from '../utils/elo.js';

/** One player of a finished game; `team` comes from the game module. */
export interface ResultPlayer { userId: string; name: string; seat: number; team: string }

export interface MatchResult {
  /** Unique per game (room id + game number): the same id is written once. */
  matchId: string;
  /** HUB-9 the game played; ratings change in this game only (HUB-7). */
  game: string;
  ranked: boolean;
  /** The winning team id. */
  winner: string;
  /** Boards (rounds) played. */
  boards: number;
  /** RANK-4 the loser left and did not come back. */
  abandoned: boolean;
  players: ResultPlayer[];
}

const changesOf = (m: MatchDoc): RatingChange[] => m.players.map((p) => ({
  seat: p.seat, userId: String(p.userId), ratingBefore: p.ratingBefore, ratingAfter: p.ratingAfter,
}));

/** RANK-1: new ratings by user id. Only a ranked game between two players changes them (Elo). */
function newRatings(r: MatchResult, before: Map<string, number>): Map<string, number> {
  const after = new Map(before);
  if (!r.ranked || r.players.length !== 2) return after;
  const [a, b] = r.players as [ResultPlayer, ResultPlayer];
  const score = a.team === r.winner ? 1 : 0;
  const [na, nb] = eloUpdate(before.get(a.userId) ?? START_RATING, before.get(b.userId) ?? START_RATING, score);
  after.set(a.userId, na);
  after.set(b.userId, nb);
  return after;
}

/**
 * HUB-7: add `delta` to a user's rating in `game` and count one ranked game,
 * starting from START_RATING / 0 when they never played it ranked.
 */
async function applyRating(userId: unknown, game: string, delta: number): Promise<void> {
  const path = `ratings.${game}`;
  await User.updateOne({ _id: userId }, [{
    $set: {
      [path]: {
        rating: { $add: [{ $ifNull: [`$${path}.rating`, START_RATING] }, delta] },
        games: { $add: [{ $ifNull: [`$${path}.games`, 0] }, 1] },
      },
    },
  }], { updatePipeline: true });
}

/**
 * RANK-4 / RANK-5: write the Match and apply rating changes exactly once.
 * The unique `matchId` index is the guard: only the call whose insert wins
 * changes ratings; a repeat (or a racing call) gets the stored result back.
 */
export async function recordMatch(r: MatchResult): Promise<RatingChange[]> {
  const existing = await Match.findOne({ matchId: r.matchId });
  if (existing) return changesOf(existing);

  const users = await User.find({ _id: { $in: r.players.map((p) => p.userId) } }, { ratings: 1 });
  const before = new Map(users.map((u) => [u.id as string, ratingOf(u, r.game).rating]));
  const after = newRatings(r, before);
  let doc: MatchDoc;
  try {
    doc = await Match.create({
      matchId: r.matchId, game: r.game, ranked: r.ranked, winner: r.winner, boards: r.boards, abandoned: r.abandoned,
      players: r.players.map((p) => ({
        userId: p.userId, name: p.name, seat: p.seat, team: p.team,
        ratingBefore: before.get(p.userId) ?? START_RATING, ratingAfter: after.get(p.userId) ?? START_RATING,
      })),
    });
  } catch (err) {
    if (!isDuplicateKey(err)) throw err;
    const won = await Match.findOne({ matchId: r.matchId });
    if (!won) throw err;
    return changesOf(won);
  }
  if (r.ranked) {
    await Promise.all(doc.players.map((p) => applyRating(p.userId, r.game, p.ratingAfter - p.ratingBefore)));
  }
  return changesOf(doc);
}
