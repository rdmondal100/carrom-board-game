import type { Redis } from '../utils/redis.js';
import {
  queueKey, queueSinceKey, WINDOW_MAX, WINDOW_START, WINDOW_STEP, WINDOW_STEP_MS,
} from '../utils/rankedConfig.js';

/** One player waiting for a ranked game. `since` is Date.now() ms at queue time. */
export interface QueueEntry { userId: string; rating: number; since: number }

/** RANK-2: ±100 at first, +50 every 5 s, at most ±400. */
export function windowFor(waitedMs: number): number {
  const steps = Math.floor(Math.max(0, waitedMs) / WINDOW_STEP_MS);
  return Math.min(WINDOW_MAX, WINDOW_START + WINDOW_STEP * steps);
}

/** Two players fit when each one's window covers the gap. */
export function canPair(a: QueueEntry, b: QueueEntry, now: number): boolean {
  const gap = Math.abs(a.rating - b.rating);
  return gap <= windowFor(now - a.since) && gap <= windowFor(now - b.since);
}

/**
 * RANK-2: pairs to start now. The longest waiter picks first and takes the
 * closest rating that fits (ties: the longer waiter). Everyone else waits.
 */
export function pairUp(entries: readonly QueueEntry[], now: number): [QueueEntry, QueueEntry][] {
  const order = [...entries].sort((x, y) => x.since - y.since || x.userId.localeCompare(y.userId));
  const taken = new Set<string>();
  const pairs: [QueueEntry, QueueEntry][] = [];
  for (const a of order) {
    if (taken.has(a.userId)) continue;
    let best: QueueEntry | null = null;
    for (const b of order) {
      if (b.userId === a.userId || taken.has(b.userId) || !canPair(a, b, now)) continue;
      if (!best || Math.abs(b.rating - a.rating) < Math.abs(best.rating - a.rating)) best = b;
    }
    if (best) {
      taken.add(a.userId).add(best.userId);
      pairs.push([a, best]);
    }
  }
  return pairs;
}

// ---- the queue in Redis: per game (HUB-6), a sorted set by rating + a hash of queue times ----

export async function queueAdd(redis: Redis, game: string, e: QueueEntry): Promise<void> {
  await redis.multi().zadd(queueKey(game), e.rating, e.userId).hset(queueSinceKey(game), e.userId, String(e.since)).exec();
}

/** RANK-2 cancel. True when the player was in the queue. */
export async function queueRemove(redis: Redis, game: string, userId: string): Promise<boolean> {
  const res = await redis.multi().zrem(queueKey(game), userId).hdel(queueSinceKey(game), userId).exec();
  return res?.[0]?.[1] === 1;
}

export async function queueHas(redis: Redis, game: string, userId: string): Promise<boolean> {
  return (await redis.zscore(queueKey(game), userId)) !== null;
}

/** Everyone in the queue, lowest rating first. */
export async function queueEntries(redis: Redis, game: string): Promise<QueueEntry[]> {
  const [flat, since] = await Promise.all([
    redis.zrange(queueKey(game), 0, -1, 'WITHSCORES'),
    redis.hgetall(queueSinceKey(game)),
  ]);
  const out: QueueEntry[] = [];
  for (let i = 0; i + 1 < flat.length; i += 2) {
    const userId = flat[i]!;
    out.push({ userId, rating: Number(flat[i + 1]), since: Number(since[userId] ?? Date.now()) });
  }
  return out;
}

/**
 * Take a matched pair out of the queue. If one of them already left (cancel
 * raced the match), the other goes back in unchanged and this returns false.
 */
export async function queueTake(redis: Redis, game: string, a: QueueEntry, b: QueueEntry): Promise<boolean> {
  const [ra, rb] = await Promise.all([queueRemove(redis, game, a.userId), queueRemove(redis, game, b.userId)]);
  if (ra && rb) return true;
  if (ra) await queueAdd(redis, game, a);
  if (rb) await queueAdd(redis, game, b);
  return false;
}

/** Empty the queue (a fresh queue room: nobody from before is still connected). */
export async function queueClear(redis: Redis, game: string): Promise<void> {
  await redis.del(queueKey(game), queueSinceKey(game));
}
