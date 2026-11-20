import RedisMock from 'ioredis-mock';
import { afterEach, describe, expect, it } from 'vitest';
import type { Redis } from '../utils/redis.js';
import {
  canPair, pairUp, queueAdd, queueClear, queueEntries, queueHas, queueRemove, queueTake, windowFor, type QueueEntry,
} from './matchmaking.js';

const e = (userId: string, rating: number, since = 0): QueueEntry => ({ userId, rating, since });

describe('matchmaking', () => {
  it('RANK-2 window: ±100, +50 every 5 s, max ±400', () => {
    expect(windowFor(0)).toBe(100);
    expect(windowFor(4999)).toBe(100);
    expect(windowFor(5000)).toBe(150);
    expect(windowFor(10_000)).toBe(200);
    expect(windowFor(29_999)).toBe(350);
    expect(windowFor(30_000)).toBe(400);
    expect(windowFor(600_000)).toBe(400);
  });

  it('RANK-2 pairs players within the window, not outside it', () => {
    expect(pairUp([e('a', 1000), e('b', 1100)], 0)).toHaveLength(1);
    expect(pairUp([e('a', 1000), e('b', 1101)], 0)).toHaveLength(0);
    expect(pairUp([e('a', 1000)], 0)).toHaveLength(0);
  });

  it('RANK-2 the window widens on schedule until a far pair fits', () => {
    const q = [e('a', 1000, 0), e('b', 1240, 0)];
    // Gap 240 fits a window of 250, reached after 15 s.
    expect(pairUp(q, 14_999)).toHaveLength(0);
    expect(pairUp(q, 15_000)).toHaveLength(1);
    // Never past ±400.
    expect(pairUp([e('a', 1000), e('b', 1401)], 3_600_000)).toHaveLength(0);
    expect(pairUp([e('a', 1000), e('b', 1400)], 30_000)).toHaveLength(1);
  });

  it('RANK-2 both windows must cover the gap (a newcomer is not thrown at a far player)', () => {
    const old = e('old', 1000, 0);
    const fresh = e('new', 1300, 30_000);
    expect(canPair(old, fresh, 30_000)).toBe(false);
    expect(canPair(old, fresh, 50_000)).toBe(true);
  });

  it('RANK-2 the longest waiter gets the closest rating; nobody is paired twice', () => {
    const q = [e('a', 1000, 0), e('b', 1090, 100), e('c', 1010, 200), e('d', 1500, 0)];
    const pairs = pairUp(q, 1000);
    expect(pairs.map(([x, y]) => [x.userId, y.userId])).toEqual([['a', 'c']]);
    const four = pairUp([e('a', 1000), e('b', 1050), e('c', 1020), e('d', 1060)], 0);
    expect(four).toHaveLength(2);
    expect(new Set(four.flat().map((x) => x.userId)).size).toBe(4);
  });

  describe('Redis queue', () => {
    const redis = new RedisMock() as unknown as Redis;
    afterEach(async () => {
      await redis.flushall();
    });

    it('RANK-2 join adds to the sorted set; cancel removes', async () => {
      await queueAdd(redis, 'carrom', e('a', 1200, 5));
      await queueAdd(redis, 'carrom', e('b', 900, 7));
      expect(await queueEntries(redis, 'carrom')).toEqual([e('b', 900, 7), e('a', 1200, 5)]);
      expect(await queueHas(redis, 'carrom', 'a')).toBe(true);
      expect(await queueRemove(redis, 'carrom', 'a')).toBe(true);
      expect(await queueRemove(redis, 'carrom', 'a')).toBe(false);
      expect(await queueHas(redis, 'carrom', 'a')).toBe(false);
      expect(await queueEntries(redis, 'carrom')).toEqual([e('b', 900, 7)]);
    });

    it('RANK-2 taking a pair removes both; a cancelled one puts the other back', async () => {
      await queueAdd(redis, 'carrom', e('a', 1000, 1));
      await queueAdd(redis, 'carrom', e('b', 1000, 2));
      expect(await queueTake(redis, 'carrom', e('a', 1000, 1), e('b', 1000, 2))).toBe(true);
      expect(await queueEntries(redis, 'carrom')).toEqual([]);

      await queueAdd(redis, 'carrom', e('a', 1000, 1));
      expect(await queueTake(redis, 'carrom', e('a', 1000, 1), e('gone', 1000, 2))).toBe(false);
      expect(await queueEntries(redis, 'carrom')).toEqual([e('a', 1000, 1)]);
    });

    it('HUB-6 each game has its own queue; clearing one leaves the other', async () => {
      await queueAdd(redis, 'carrom', e('a', 1000, 1));
      await queueAdd(redis, 'ludo', e('b', 1000, 2));
      expect(await queueEntries(redis, 'carrom')).toEqual([e('a', 1000, 1)]);
      expect(await queueEntries(redis, 'ludo')).toEqual([e('b', 1000, 2)]);
      expect(await queueHas(redis, 'ludo', 'a')).toBe(false);
      await queueClear(redis, 'carrom');
      expect(await queueEntries(redis, 'carrom')).toEqual([]);
      expect(await queueEntries(redis, 'ludo')).toEqual([e('b', 1000, 2)]);
    });
  });
});
