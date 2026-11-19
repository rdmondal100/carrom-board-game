import { randomInt } from 'node:crypto';
import mongoose, { Schema, type HydratedDocument, type InferSchemaType } from 'mongoose';
import type { PublicUser } from '@carrom/protocol/api';

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

const userSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, minlength: NAME_MIN, maxlength: NAME_MAX },
    email: { type: String, lowercase: true, trim: true },
    passwordHash: { type: String },
    googleId: { type: String },
    isGuest: { type: Boolean, required: true, default: true },
    avatar: { type: Number, required: true, default: 0, min: 0, max: AVATAR_COUNT - 1 },
    rating: { type: Number, required: true, default: START_RATING },
    coins: { type: Number, required: true, default: 0, min: 0 },
    cosmetics: {
      equipped: { type: [String], default: [] },
      owned: { type: [String], default: [] },
    },
  },
  { timestamps: true },
);

// Unique only among users that have the field (guests have neither).
userSchema.index({ email: 1 }, { unique: true, partialFilterExpression: { email: onlyStrings } });
userSchema.index({ googleId: 1 }, { unique: true, partialFilterExpression: { googleId: onlyStrings } });

export type UserFields = InferSchemaType<typeof userSchema>;
export type UserDoc = HydratedDocument<UserFields>;

export const User = mongoose.model('User', userSchema);

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
    rating: u.rating,
    coins: u.coins,
    cosmetics: { equipped: [...(u.cosmetics?.equipped ?? [])], owned: [...(u.cosmetics?.owned ?? [])] },
    createdAt: u.createdAt.toISOString(),
  };
}

/** Mongo duplicate-key error (a unique index said no). */
export function isDuplicateKey(err: unknown): boolean {
  return typeof err === 'object' && err !== null && (err as { code?: unknown }).code === 11000;
}
