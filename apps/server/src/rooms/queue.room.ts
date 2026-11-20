import { matchMaker, Room, ServerError, type AuthContext, type Client } from '@colyseus/core';
import { z } from 'zod';
import { MSG, RANKED_ROOM, type QueueMessage, type SeatReservation } from '@carrom/protocol';
import { ratingOf, User } from '../models/user.model.js';
import { verifyToken } from '../utils/jwt.js';
import { logger } from '../utils/logger.js';
import { DEFAULT_RANKED_TIMING, type RankedTiming } from '../utils/rankedConfig.js';
import type { Redis } from '../utils/redis.js';
import { isRankedGame } from './games.js';
import {
  pairUp, queueAdd, queueClear, queueEntries, queueHas, queueRemove, queueTake, windowFor, type QueueEntry,
} from './matchmaking.js';
import { rankedCreateOptions } from './ranked.js';

interface QueueUser { userId: string; rating: number }

/** Room capacity: everyone looking for a ranked game of one kind shares one queue room. */
const QUEUE_CAPACITY = 10_000;

/** HUB-6 the queue join / create options: which game's queue. */
const QueueOptionsSchema = z.object({ gameId: z.string().min(1) });

/**
 * RANK-2 / RANK-3 / HUB-6: players join this room to queue for one game
 * (leaving it cancels). The queue itself is a Redis sorted set by that game's
 * rating. Every tick it pairs players whose windows fit, makes a ranked room,
 * reserves both seats and sends each player their reservation. After 60 s
 * unmatched it offers a bot game. One queue room per game (clients use
 * joinOrCreate with `{ gameId }`; the room type filters by it).
 */
export class QueueRoom extends Room {
  jwtSecret = '';
  redis: Redis | null = null;
  rankedTiming: RankedTiming = DEFAULT_RANKED_TIMING;
  /** HUB-6 the game this queue is for. */
  gameId = '';
  private readonly byUser = new Map<string, Client>();
  private readonly offered = new Set<string>();
  private busy = false;

  // Players send nothing; leaving the room is the cancel.
  messages = { [MSG]: () => {} };

  async onCreate(options: unknown): Promise<void> {
    const opts = QueueOptionsSchema.safeParse(options);
    if (!opts.success || !isRankedGame(opts.data.gameId)) throw new ServerError(400, 'No ranked play for this game');
    this.gameId = opts.data.gameId;
    this.maxClients = QUEUE_CAPACITY;
    // A new queue room means nobody from an old one is still connected.
    await queueClear(this.db(), this.gameId);
    this.clock.setInterval(() => void this.tick(), this.rankedTiming.tickMs);
  }

  /** Signed-in users only (guests too, RANK-7); one queue entry per user. */
  async onAuth(_client: Client, _options: unknown, context: AuthContext): Promise<QueueUser> {
    const claims = verifyToken(context.token, this.jwtSecret);
    if (!claims) throw new ServerError(401, 'Sign in to play ranked');
    const user = await User.findById(claims.sub).catch(() => null);
    if (!user) throw new ServerError(401, 'Sign in to play ranked');
    if (this.byUser.has(claims.sub) || (await queueHas(this.db(), this.gameId, claims.sub))) {
      throw new ServerError(409, 'You are already in the queue');
    }
    return { userId: claims.sub, rating: ratingOf(user, this.gameId).rating };
  }

  async onJoin(client: Client, _options: unknown, auth: QueueUser): Promise<void> {
    const entry: QueueEntry = { userId: auth.userId, rating: auth.rating, since: Date.now() };
    this.byUser.set(auth.userId, client);
    await queueAdd(this.db(), this.gameId, entry);
    this.status(client, entry, entry.since);
  }

  /** RANK-2 cancel. */
  async onLeave(client: Client): Promise<void> {
    const userId = (client.auth as QueueUser | undefined)?.userId;
    if (!userId || this.byUser.get(userId) !== client) return;
    this.byUser.delete(userId);
    this.offered.delete(userId);
    await queueRemove(this.db(), this.gameId, userId);
  }

  /** RANK-2: pair who fits, then tell everyone still waiting their window. */
  async tick(now = Date.now()): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    try {
      const redis = this.db();
      let entries = await queueEntries(redis, this.gameId);
      // Drop entries with nobody connected here (left while a tick was running).
      for (const e of entries) if (!this.byUser.has(e.userId)) await queueRemove(redis, this.gameId, e.userId);
      entries = entries.filter((e) => this.byUser.has(e.userId));
      const matched = new Set<string>();
      for (const [a, b] of pairUp(entries, now)) {
        if (await this.startGame(a, b)) matched.add(a.userId).add(b.userId);
      }
      for (const e of entries) {
        const c = this.byUser.get(e.userId);
        if (c && !matched.has(e.userId)) this.status(c, e, now);
      }
    } catch (err) {
      logger.error('ranked queue tick failed', err);
    } finally {
      this.busy = false;
    }
  }

  /** Make the ranked room and hand both players a reserved seat. False if the pair fell apart. */
  private async startGame(a: QueueEntry, b: QueueEntry): Promise<boolean> {
    const redis = this.db();
    if (!(await queueTake(redis, this.gameId, a, b))) return false;
    const ca = this.byUser.get(a.userId);
    const cb = this.byUser.get(b.userId);
    if (!ca || !cb) {
      if (ca) await queueAdd(redis, this.gameId, a);
      if (cb) await queueAdd(redis, this.gameId, b);
      return false;
    }
    try {
      const room = await matchMaker.createRoom(RANKED_ROOM, rankedCreateOptions(this.gameId, a.userId, b.userId));
      const [ra, rb] = await Promise.all([
        matchMaker.reserveSeatFor(room, {}, { userId: a.userId }),
        matchMaker.reserveSeatFor(room, {}, { userId: b.userId }),
      ]);
      for (const id of [a.userId, b.userId]) {
        this.byUser.delete(id);
        this.offered.delete(id);
      }
      this.tell(ca, { type: 'matched', reservation: ra as SeatReservation });
      this.tell(cb, { type: 'matched', reservation: rb as SeatReservation });
      return true;
    } catch (err) {
      logger.error('ranked room not created', err);
      await queueAdd(redis, this.gameId, a);
      await queueAdd(redis, this.gameId, b);
      return false;
    }
  }

  private status(client: Client, e: QueueEntry, now: number): void {
    const waitedMs = Math.max(0, now - e.since);
    this.tell(client, { type: 'queue', waitedMs, window: windowFor(waitedMs), rating: e.rating });
    // RANK-3: once, after a minute unmatched.
    if (waitedMs >= this.rankedTiming.botOfferMs && !this.offered.has(e.userId)) {
      this.offered.add(e.userId);
      this.tell(client, { type: 'botOffer' });
    }
  }

  private tell(client: Client, msg: QueueMessage): void {
    client.send(MSG, msg);
  }

  private db(): Redis {
    if (!this.redis) throw new Error('QueueRoom needs Redis');
    return this.redis;
  }
}

/** A QueueRoom class bound to the JWT secret, Redis and timings. */
export function queueRoomFor(
  jwtSecret: string, redis: Redis, rankedTiming: RankedTiming = DEFAULT_RANKED_TIMING,
): typeof QueueRoom {
  return class extends QueueRoom {
    jwtSecret = jwtSecret;
    redis = redis;
    rankedTiming = rankedTiming;
  };
}
