import type { Redis } from '../utils/redis.js';
import {
  QUEUE_KEY, QUEUE_SINCE_KEY, WINDOW_MAX, WINDOW_START, WINDOW_STEP, WINDOW_STEP_MS,
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

// ---- the queue in Redis: a sorted set by rating + a hash of queue times ----

export async function queueAdd(redis: Redis, e: QueueEntry): Promise<void> {
  await redis.multi().zadd(QUEUE_KEY, e.rating, e.userId).hset(QUEUE_SINCE_KEY, e.userId, String(e.since)).exec();
}

/** RANK-2 cancel. True when the player was in the queue. */
export async function queueRemove(redis: Redis, userId: string): Promise<boolean> {
  const res = await redis.multi().zrem(QUEUE_KEY, userId).hdel(QUEUE_SINCE_KEY, userId).exec();
  return res?.[0]?.[1] === 1;
}

export async function queueHas(redis: Redis, userId: string): Promise<boolean> {
  return (await redis.zscore(QUEUE_KEY, userId)) !== null;
}

/** Everyone in the queue, lowest rating first. */
export async function queueEntries(redis: Redis): Promise<QueueEntry[]> {
  const [flat, since] = await Promise.all([
    redis.zrange(QUEUE_KEY, 0, -1, 'WITHSCORES'),
    redis.hgetall(QUEUE_SINCE_KEY),
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
export async function queueTake(redis: Redis, a: QueueEntry, b: QueueEntry): Promise<boolean> {
  const [ra, rb] = await Promise.all([queueRemove(redis, a.userId), queueRemove(redis, b.userId)]);
  if (ra && rb) return true;
  if (ra) await queueAdd(redis, a);
  if (rb) await queueAdd(redis, b);
  return false;
}

/** Empty the queue (a fresh queue room: nobody from before is still connected). */
export async function queueClear(redis: Redis): Promise<void> {
  await redis.del(QUEUE_KEY, QUEUE_SINCE_KEY);
}
