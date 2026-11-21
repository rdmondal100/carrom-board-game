import * as protocol from '@carrom/protocol/api';
import { COSMETIC_GAMES, DEFAULT_SLOTS, ownedItems } from '@carrom/protocol';
import { GAME_IDS } from '@hub/game-kit';
import { afterAll, beforeAll, beforeEach, describe, expect, inject, it } from 'vitest';
import { connectDb, disconnectDb } from '../connectDb.js';
import * as model from './user.model.js';

const { User, toPublicUser } = model;

describe('user model', () => {
  beforeAll(async () => {
    await connectDb(inject('mongoUri'));
    await User.syncIndexes();
  });
  beforeEach(async () => {
    await User.deleteMany({});
  });
  afterAll(async () => {
    await disconnectDb();
  });

  it('HAPP-5 the cosmetic games are the game-kit games', () => {
    expect([...COSMETIC_GAMES].sort()).toEqual([...GAME_IDS].sort());
  });

  it('AUTH-1 server constants match the protocol', () => {
    expect([model.NAME_MIN, model.NAME_MAX, model.PASSWORD_MIN, model.AVATAR_COUNT])
      .toEqual([protocol.NAME_MIN, protocol.NAME_MAX, protocol.PASSWORD_MIN, protocol.AVATAR_COUNT]);
  });

  it('AUTH-1 defaults: guest, rating 1000, 0 coins, avatar 0, no cosmetics, timestamps', async () => {
    const u = await User.create({ name: 'Rina' });
    expect(u.isGuest).toBe(true);
    expect(model.ratingOf(u, 'carrom')).toEqual({ rating: 1000, games: 0 });
    expect(toPublicUser(u)).toMatchObject({ rating: 1000, ratings: {} });
    expect(u.coins).toBe(0);
    expect(u.avatar).toBe(0);
    expect(u.createdAt).toBeInstanceOf(Date);
    expect(u.updatedAt).toBeInstanceOf(Date);
    const pub = toPublicUser(u);
    expect(pub.cosmetics).toEqual({ equipped: DEFAULT_SLOTS, owned: ownedItems([]) });
    expect(pub.cosmetics.equipped.carrom).toEqual({ striker: 'classic-striker', coins: 'classic-coins', board: 'classic-board' });
    expect(pub).toMatchObject({ name: 'Rina', email: null, hasPassword: false, hasGoogle: false });
  });

  it('AUTH-1 name must be 3–20 characters', async () => {
    await expect(User.create({ name: 'ab' })).rejects.toThrow();
    await expect(User.create({ name: 'x'.repeat(21) })).rejects.toThrow();
    await expect(User.create({ name: 'রিনা' })).resolves.toBeTruthy();
  });

  it('AUTH-1 avatar must be in the fixed set', async () => {
    await expect(User.create({ name: 'Rina', avatar: model.AVATAR_COUNT })).rejects.toThrow();
    await expect(User.create({ name: 'Rina', avatar: -1 })).rejects.toThrow();
  });

  it('AUTH-1 email is lowercased and unique; many users may have none', async () => {
    const u = await User.create({ name: 'Rina', email: 'Rina@Example.COM', isGuest: false });
    expect(u.email).toBe('rina@example.com');
    await expect(User.create({ name: 'Tuhin', email: 'rina@example.com' })).rejects.toThrow(/duplicate key/);
    await User.create({ name: 'Guest A' });
    await User.create({ name: 'Guest B' });
    expect(await User.countDocuments({})).toBe(3);
  });

  it('AUTH-1 googleId is unique; many users may have none', async () => {
    await User.create({ name: 'Rina', googleId: 'g-1' });
    await expect(User.create({ name: 'Tuhin', googleId: 'g-1' })).rejects.toThrow(/duplicate key/);
    await User.create({ name: 'Tuhin', googleId: 'g-2' });
  });

  it('AUTH-1 public user never holds the hash or google id', async () => {
    const u = await User.create({ name: 'Rina', passwordHash: 'h', googleId: 'g' });
    const json = JSON.stringify(toPublicUser(u));
    expect(json).not.toMatch(/passwordHash|googleId/);
    expect(toPublicUser(u)).toMatchObject({ hasPassword: true, hasGoogle: true });
  });

  it('AUTH-2 guest name looks like Player-1234', () => {
    for (let i = 0; i < 50; i++) expect(model.guestName()).toMatch(/^Player-\d{4}$/);
  });
});
