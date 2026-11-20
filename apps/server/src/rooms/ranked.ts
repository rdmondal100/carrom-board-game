import { randomBytes, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import { seatsFor } from '@carrom/rules';
import { RANKED_OPTIONS } from '../utils/rankedConfig.js';

/**
 * RANK-2: only the matchmaker may create a ranked room. It passes this
 * per-process key; a client asking Colyseus for a "ranked" room can't know it.
 */
const RANKED_KEY = randomBytes(24).toString('base64url');

export interface RankedCreateOptions { key: string; players: [string, string] }

const schema = z.object({ key: z.string(), players: z.tuple([z.string().min(1), z.string().min(1)]) });

/** Options the matchmaker creates a ranked room with: the two user ids in seat order. */
export function rankedCreateOptions(a: string, b: string): RankedCreateOptions {
  return { key: RANKED_KEY, players: [a, b] };
}

/** The user ids of a valid ranked create request, or null. */
export function parseRankedCreate(options: unknown): [string, string] | null {
  const r = schema.safeParse(options);
  if (!r.success) return null;
  const given = Buffer.from(r.data.key);
  const ours = Buffer.from(RANKED_KEY);
  if (given.length !== ours.length || !timingSafeEqual(given, ours)) return null;
  return r.data.players;
}

/** RANK-1: the seat for the i-th matched player (1v1: seats 0 and 2). */
export function rankedSeat(players: readonly string[], userId: string): number | null {
  const i = players.indexOf(userId);
  return i < 0 ? null : (seatsFor(RANKED_OPTIONS.format)[i] ?? null);
}
