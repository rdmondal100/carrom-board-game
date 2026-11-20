import { afterAll, afterEach, beforeAll, describe, expect, inject, it } from 'vitest';
import { connectDb, disconnectDb } from '../connectDb.js';
import { Match } from '../models/match.model.js';
import { ratingOf, User } from '../models/user.model.js';
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
    const a = await User.create({ name: 'Anik', ratings: { carrom: { rating: ra, games: 0 } } });
    const b = await User.create({ name: 'Bina', ratings: { carrom: { rating: rb, games: 0 } } });
    return {
      matchId: 'room1:1', game: 'carrom', ranked: true, winner: 'A', boards: 1, abandoned: false,
      players: [
        { userId: a.id as string, name: 'Anik', seat: 0, team: 'A' }, { userId: b.id as string, name: 'Bina', seat: 2, team: 'B' },
      ],
    };
  }
  const ratingsIn = async (r: MatchResult, game: string) =>
    Promise.all(r.players.map(async (p) => ratingOf((await User.findById(p.userId))!, game)));
  const ratings = async (r: MatchResult) => (await ratingsIn(r, 'carrom')).map((x) => x.rating);

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
    expect((await ratingsIn(r, 'carrom')).map((x) => x.games)).toEqual([1, 1]);
  });

  it('RANK-5 the Match stores players, winner, boards, ranked and createdAt', async () => {
    const r = await pair();
    await recordMatch({ ...r, winner: 'B', abandoned: true });
    const m = (await Match.findOne({ matchId: r.matchId }))!;
    expect(m.winner).toBe('B');
    expect(m.game).toBe('carrom');
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
    expect((await ratingsIn(r, 'carrom')).map((x) => x.games)).toEqual([0, 0]);
  });

  it('HUB-7 ratings are per game: a ludo result starts both at 1000 and leaves carrom alone', async () => {
    const r = await pair(1300, 900);
    await recordMatch({ ...r, game: 'ludo', matchId: 'ludo:1' });
    expect((await ratingsIn(r, 'ludo')).map((x) => [x.rating, x.games])).toEqual([[1016, 1], [984, 1]]);
    expect(await ratings(r)).toEqual([1300, 900]);
    expect((await ratingsIn(r, 'carrom')).map((x) => x.games)).toEqual([0, 0]);
    expect((await Match.findOne({ matchId: 'ludo:1' }))!.game).toBe('ludo');
  });
});
