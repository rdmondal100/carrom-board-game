import { randomInt } from 'node:crypto';
import { isValidObjectId } from 'mongoose';
import { INVITE_ALPHABET, PLAYER_CODE_LENGTH, type PlayerSummary } from '@carrom/protocol';
import { isDuplicateKey, User, type UserDoc } from '../models/user.model.js';

/** ADDA-1 / ADDA-2 a random code from the invite alphabet (no 0/O/1/I). */
export function randomCode(length: number, pick: (n: number) => number = randomInt): string {
  let code = '';
  for (let i = 0; i < length; i++) code += INVITE_ALPHABET[pick(INVITE_ALPHABET.length)];
  return code;
}

/** Upper case, trimmed; null when it can't be a code of this length. */
export function cleanCode(raw: unknown, length: number): string | null {
  if (typeof raw !== 'string') return null;
  const code = raw.trim().toUpperCase();
  return code.length === length && [...code].every((c) => INVITE_ALPHABET.includes(c)) ? code : null;
}

/** Tries before giving up on finding a free code (8 chars from 32: a clash is very rare). */
export const CODE_TRIES = 10;

/** ADDA-1 the player's code, given on first use (the unique index settles races). */
export async function ensurePlayerCode(user: UserDoc): Promise<string> {
  if (user.playerCode) return user.playerCode;
  for (let i = 0; i < CODE_TRIES; i++) {
    const code = randomCode(PLAYER_CODE_LENGTH);
    try {
      const got = await User.findOneAndUpdate(
        { _id: user._id, playerCode: { $exists: false } }, { $set: { playerCode: code } }, { returnDocument: 'after' },
      );
      if (got?.playerCode) return got.playerCode;
      const again = await User.findById(user._id, { playerCode: 1 });
      if (again?.playerCode) return again.playerCode;
      throw new Error('Account not found');
    } catch (err) {
      if (!isDuplicateKey(err)) throw err;
    }
  }
  throw new Error('No free player code');
}

export const summaryOf = (u: Pick<UserDoc, 'id' | 'name' | 'avatar'>): PlayerSummary => ({
  id: u.id as string, name: u.name, avatar: u.avatar,
});

/** Users by id, for building lists (missing ids are skipped by callers). */
export async function usersById(ids: readonly string[]): Promise<Map<string, UserDoc>> {
  const users = await User.find({ _id: { $in: [...new Set(ids)].filter((id) => isValidObjectId(id)) } });
  return new Map(users.map((u) => [u.id as string, u]));
}

/** ADDA-1 / ADDA-7 has either player blocked the other? */
export function eitherBlocked(x: Pick<UserDoc, 'id' | 'blocked'>, y: Pick<UserDoc, 'id' | 'blocked'>): boolean {
  return (x.blocked ?? []).includes(y.id as string) || (y.blocked ?? []).includes(x.id as string);
}
