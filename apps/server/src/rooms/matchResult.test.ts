import { afterAll, afterEach, beforeAll, describe, expect, inject, it } from 'vitest';
import { connectDb, disconnectDb } from '../connectDb.js';
import { Match } from '../models/match.model.js';
import { User } from '../models/user.model.js';
import { recordMatch, type MatchResult } from './matchResult.js';

describe('match results', () => {
  beforeAll(async () => {
    await connectDb(inject('mongoUri'));
    await Match.init();
  });
  afterEach(async () => {
    await Promise.all([User.deleteMany({}), Match.deleteMany({})]);
  });
  afterAll(disconnectDb);

  async function pair(ra = 1000, rb = 1000): Promise<MatchResult> {
    const a = await User.create({ name: 'Anik', rating: ra });
    const b = await User.create({ name: 'Bina', rating: rb });
    return {
      matchId: 'room1:1', ranked: true, format: '1v1', winner: 'A', boards: 1, abandoned: false,
      players: [{ userId: a.id as string, name: 'Anik', seat: 0 }, { userId: b.id as string, name: 'Bina', seat: 2 }],
    };
  }
  const ratings = async (r: MatchResult) => Promise.all(r.players.map(async (p) => (await User.findById(p.userId))!.rating));

  it('RANK-4 a ranked result applies once: winner +16, loser −16', async () => {
    const r = await pair();
    const changes = await recordMatch(r);
    expect(changes.map((c) => [c.ratingBefore, c.ratingAfter])).toEqual([[1000, 1016], [1000, 984]]);
    expect(await ratings(r)).toEqual([1016, 984]);
    // The same match again (a retry, or a second gameEnd) changes nothing.
    expect(await recordMatch(r)).toEqual(changes);
    expect(await ratings(r)).toEqual([1016, 984]);
    expect(await Match.countDocuments()).toBe(1);
  });

  it('RANK-4 racing writes of the same match still apply it exactly once', async () => {
    const r = await pair(1200, 1600);
    const results = await Promise.all([recordMatch(r), recordMatch(r), recordMatch(r)]);
    for (const c of results) expect(c).toEqual(results[0]);
    expect(await ratings(r)).toEqual([1229, 1571]);
    expect(await Match.countDocuments()).toBe(1);
    const users = await User.find({}, { rankedGames: 1 });
    expect(users.map((u) => u.rankedGames)).toEqual([1, 1]);
  });

  it('RANK-5 the Match stores players, winner, boards, ranked and createdAt', async () => {
    const r = await pair();
    await recordMatch({ ...r, winner: 'B', abandoned: true });
    const m = (await Match.findOne({ matchId: r.matchId }))!;
    expect(m.winner).toBe('B');
    expect(m.boards).toBe(1);
    expect(m.ranked).toBe(true);
    expect(m.abandoned).toBe(true);
    expect(m.createdAt).toBeInstanceOf(Date);
    expect(m.players.map((p) => [String(p.userId), p.seat, p.team, p.ratingBefore, p.ratingAfter])).toEqual([
      [r.players[0]!.userId, 0, 'A', 1000, 984],
      [r.players[1]!.userId, 2, 'B', 1000, 1016],
    ]);
  });

  it('RANK-3 an unranked game is recorded but no rating changes', async () => {
    const r = await pair();
    const changes = await recordMatch({ ...r, ranked: false });
    expect(changes.every((c) => c.ratingAfter === c.ratingBefore)).toBe(true);
    expect(await ratings(r)).toEqual([1000, 1000]);
    expect((await User.find({}, { rankedGames: 1 })).map((u) => u.rankedGames)).toEqual([0, 0]);
  });
});
