import { randomInt } from 'node:crypto';
import mongoose, { Schema, type HydratedDocument, type InferSchemaType } from 'mongoose';
import { ownedItems, resolveEquippedMap } from '@carrom/protocol';
import type { GameRating, PublicUser } from '@carrom/protocol/api';
import { GAME_IDS } from '@hub/game-kit';

// Copies of the protocol constants (the server can't load workspace packages
// at runtime yet); user.model.test.ts checks they match.
export const NAME_MIN = 3;
export const NAME_MAX = 20;
export const PASSWORD_MIN = 8;
/** bcrypt only reads the first 72 bytes of a password. */
export const PASSWORD_MAX_BYTES = 72;
export const AVATAR_COUNT = 12;
export const START_RATING = 1000;
export const BCRYPT_COST = 12;

const onlyStrings = { $type: 'string' } as const;

/** HUB-7 games that keep a rating (one leaderboard index each). */
export const RATED_GAMES = GAME_IDS;

/** HUB-7 one game's rating and ranked games played. */
const gameRatingSchema = new Schema(
  {
    rating: { type: Number, required: true, default: START_RATING },
    /** RANK-6 ranked games finished; only players with at least one are on that game's leaderboard. */
    games: { type: Number, required: true, default: 0, min: 0 },
  },
  { _id: false },
);

const userSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, minlength: NAME_MIN, maxlength: NAME_MAX },
    email: { type: String, lowercase: true, trim: true },
    passwordHash: { type: String },
    googleId: { type: String },
    isGuest: { type: Boolean, required: true, default: true },
    avatar: { type: Number, required: true, default: 0, min: 0, max: AVATAR_COUNT - 1 },
    /** HUB-7 rating per game id; a missing game reads as START_RATING with 0 games. */
    ratings: { type: Map, of: gameRatingSchema, default: () => new Map() },
    coins: { type: Number, required: true, default: 0, min: 0 },
    /** COS-4 / HAPP-5 equipped entries (`game:id`, or a bare id from spec 12 = carrom); COS-3 bought ids (defaults are not stored, COS-5). */
    cosmetics: {
      equipped: { type: [String], default: [] },
      owned: { type: [String], default: [] },
    },
    /** COS-2 UTC day (YYYY-MM-DD) the daily bonus was last given. */
    dailyBonusDay: { type: String, default: '' },
    /** COS-2 UTC day of the counted Vs-bot rewards, and how many were given that day. */
    botRewardDay: { type: String, default: '' },
    botRewards: { type: Number, default: 0, min: 0 },
    /** AD-3 UTC day of the counted rewarded ads, and how many paid that day. */
    adRewardDay: { type: String, default: '' },
    adRewards: { type: Number, default: 0, min: 0 },
    /** VOICE-6 user ids this player blocked (never hears them again). */
    blocked: { type: [String], default: [] },
  },
  { timestamps: true },
);

// Unique only among users that have the field (guests have neither).
userSchema.index({ email: 1 }, { unique: true, partialFilterExpression: { email: onlyStrings } });
userSchema.index({ googleId: 1 }, { unique: true, partialFilterExpression: { googleId: onlyStrings } });
// RANK-6 / HUB-7 each game's leaderboard order: rating, then the older account first.
for (const g of RATED_GAMES) {
  userSchema.index(
    { [`ratings.${g}.rating`]: -1, createdAt: 1, _id: 1 },
    { partialFilterExpression: { [`ratings.${g}.games`]: { $gt: 0 } } },
  );
}

export type UserFields = InferSchemaType<typeof userSchema>;
export type UserDoc = HydratedDocument<UserFields>;

export const User = mongoose.model('User', userSchema);

/** HUB-7 a user's rating in one game (defaults when they never played it ranked). */
export function ratingOf(u: Pick<UserDoc, 'ratings'>, gameId: string): GameRating {
  const r = u.ratings?.get(gameId);
  return { rating: r?.rating ?? START_RATING, games: r?.games ?? 0 };
}

/** "Player-1234": the default guest name. */
export function guestName(): string {
  return `Player-${randomInt(1000, 10000)}`;
}

/** What the API sends for a user: never the hash or the Google id. */
export function toPublicUser(u: UserDoc): PublicUser {
  return {
    id: u.id as string,
    name: u.name,
    email: u.email ?? null,
    isGuest: u.isGuest,
    hasPassword: typeof u.passwordHash === 'string',
    hasGoogle: typeof u.googleId === 'string',
    avatar: u.avatar,
    rating: ratingOf(u, 'carrom').rating,
    ratings: Object.fromEntries([...(u.ratings ?? new Map()).keys()].map((g) => [g, ratingOf(u, g)])),
    coins: u.coins,
    cosmetics: {
      equipped: resolveEquippedMap(u.cosmetics?.equipped ?? []),
      owned: ownedItems(u.cosmetics?.owned ?? []),
    },
    blocked: [...(u.blocked ?? [])],
    createdAt: u.createdAt.toISOString(),
  };
}

/** Mongo duplicate-key error (a unique index said no). */
export function isDuplicateKey(err: unknown): boolean {
  return typeof err === 'object' && err !== null && (err as { code?: unknown }).code === 11000;
}
