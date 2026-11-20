import { afterAll, afterEach, beforeAll, describe, expect, inject, it } from 'vitest';
import { connectDb, disconnectDb } from '../connectDb.js';
import { Match } from '../models/match.model.js';
import { ratingOf, toPublicUser, User } from '../models/user.model.js';
import { runMigrations } from './migrations.js';

describe('HUB-8 migrations', () => {
  beforeAll(async () => {
    await connectDb(inject('mongoUri'));
  });
  afterEach(async () => {
    await Promise.all([User.deleteMany({}), Match.deleteMany({})]);
  });
  afterAll(disconnectDb);

  /** A user document as the pre-hub server wrote it. */
  async function oldUser(name: string, rating: number, rankedGames: number) {
    const now = new Date();
    const r = await User.collection.insertOne({
      name, isGuest: true, avatar: 0, rating, rankedGames, coins: 5,
      cosmetics: { equipped: [], owned: [] }, createdAt: now, updatedAt: now,
    });
    return r.insertedId;
  }

  it('HUB-8 old rating/rankedGames move into ratings.carrom; a second run changes nothing', async () => {
    const id = await oldUser('Oldie', 1123, 4);
    const fresh = await User.create({ name: 'Newbie' });
    expect(await runMigrations()).toEqual({ users: 1, matches: 0 });

    const u = (await User.findById(id))!;
    expect(ratingOf(u, 'carrom')).toEqual({ rating: 1123, games: 4 });
    expect(toPublicUser(u)).toMatchObject({ rating: 1123, ratings: { carrom: { rating: 1123, games: 4 } }, coins: 5 });
    const raw = await User.collection.findOne({ _id: id });
    expect(raw).not.toHaveProperty('rating');
    expect(raw).not.toHaveProperty('rankedGames');
    // A user made after the hub has nothing to move.
    expect(ratingOf((await User.findById(fresh.id))!, 'carrom')).toEqual({ rating: 1000, games: 0 });

    const before = await User.collection.find().sort({ _id: 1 }).toArray();
    expect(await runMigrations()).toEqual({ users: 0, matches: 0 });
    expect(await User.collection.find().sort({ _id: 1 }).toArray()).toEqual(before);
  });

  it('HUB-8 an existing ratings.carrom is kept (old fields only removed)', async () => {
    const id = await oldUser('Both', 1000, 0);
    await User.collection.updateOne({ _id: id }, { $set: { 'ratings.carrom': { rating: 1200, games: 3 } } });
    await runMigrations();
    expect(ratingOf((await User.findById(id))!, 'carrom')).toEqual({ rating: 1200, games: 3 });
  });

  it('HUB-8 matches without a game become carrom matches', async () => {
    await Match.collection.insertOne({
      matchId: 'old:1', players: [], winner: 'A', boards: 1, ranked: true, abandoned: false, createdAt: new Date(),
    });
    expect((await runMigrations()).matches).toBe(1);
    expect((await Match.findOne({ matchId: 'old:1' }))!.game).toBe('carrom');
    expect((await runMigrations()).matches).toBe(0);
  });
});
