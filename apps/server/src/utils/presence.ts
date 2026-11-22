import { randomUUID } from 'node:crypto';
import { NOTICES_MAX, PRESENCE_TTL_S, type Notice, type Presence } from '@carrom/protocol';
import type { Redis } from './redis.js';

/** A notice before it gets its id and time. */
export type NewNotice = Notice extends infer N ? (N extends Notice ? Omit<N, 'id' | 'at'> : never) : never;

/**
 * ADDA-1 / ADDA-6: who is online (and in which game), and each player's
 * in-app notices until they fetch them. Redis in production (shared by every
 * server process); memory when there is no Redis (tests, dev without it).
 */
export interface PresenceStore {
  /** The player is here now: in `game`, or in the menus (null). Lasts PRESENCE_TTL_S. */
  beat(userId: string, game: string | null): Promise<void>;
  statuses(userIds: readonly string[]): Promise<Map<string, Presence>>;
  push(userId: string, notice: NewNotice): Promise<void>;
  /** The player's notices, oldest first; they are gone from the store after this. */
  take(userId: string): Promise<Notice[]>;
}

/** Notices nobody fetched are dropped after a week. */
const NOTICE_TTL_S = 7 * 24 * 3600;
const IN_MENU = '-';

const stamp = (n: NewNotice, now: number): Notice => ({ ...n, id: randomUUID(), at: now } as Notice);

function presenceOf(raw: string | null | undefined): Presence {
  if (raw === null || raw === undefined) return { state: 'offline' };
  return raw === IN_MENU ? { state: 'menu' } : { state: 'game', game: raw };
}

function parseNotice(raw: string): Notice | null {
  try {
    return JSON.parse(raw) as Notice;
  } catch {
    return null;
  }
}

export function redisPresence(redis: Redis): PresenceStore {
  const pKey = (id: string) => `presence:${id}`;
  const nKey = (id: string) => `notices:${id}`;
  return {
    async beat(userId, game) {
      await redis.set(pKey(userId), game ?? IN_MENU, 'EX', PRESENCE_TTL_S);
    },
    async statuses(userIds) {
      const out = new Map<string, Presence>();
      if (userIds.length === 0) return out;
      const raw = await redis.mget(...userIds.map(pKey));
      userIds.forEach((id, i) => out.set(id, presenceOf(raw[i])));
      return out;
    },
    async push(userId, notice) {
      await redis.multi()
        .rpush(nKey(userId), JSON.stringify(stamp(notice, Date.now())))
        .ltrim(nKey(userId), -NOTICES_MAX, -1)
        .expire(nKey(userId), NOTICE_TTL_S)
        .exec();
    },
    async take(userId) {
      const res = await redis.multi().lrange(nKey(userId), 0, -1).del(nKey(userId)).exec();
      const list = (res?.[0]?.[1] ?? []) as string[];
      return list.map(parseNotice).filter((n): n is Notice => n !== null);
    },
  };
}

/** One process only: fine for tests and a single dev server. */
export function memoryPresence(now: () => number = Date.now): PresenceStore {
  const seen = new Map<string, { game: string; until: number }>();
  const notices = new Map<string, Notice[]>();
  return {
    async beat(userId, game) {
      seen.set(userId, { game: game ?? IN_MENU, until: now() + PRESENCE_TTL_S * 1000 });
    },
    async statuses(userIds) {
      const t = now();
      return new Map(userIds.map((id) => {
        const s = seen.get(id);
        return [id, presenceOf(s && s.until > t ? s.game : null)];
      }));
    },
    async push(userId, notice) {
      const list = [...(notices.get(userId) ?? []), stamp(notice, now())];
      notices.set(userId, list.slice(-NOTICES_MAX));
    },
    async take(userId) {
      const list = notices.get(userId) ?? [];
      notices.delete(userId);
      return list;
    },
  };
}
