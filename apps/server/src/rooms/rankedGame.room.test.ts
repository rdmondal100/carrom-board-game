import { boot, type ColyseusTestServer } from '@colyseus/testing';
import type { Room as SdkRoom } from '@colyseus/sdk';
import RedisMock from 'ioredis-mock';
import { chooseShot } from '@carrom/bot';
import {
  GAME_ROOM, MSG, parseQueueMessage, QUEUE_ROOM, RANKED_ROOM, type QueueMessage, type SeatReservation,
} from '@carrom/protocol';
import type { GameState } from '@carrom/rules';
import { afterAll, afterEach, beforeAll, describe, expect, inject, it } from 'vitest';
import { createServer } from '../app.js';
import { connectDb, disconnectDb } from '../connectDb.js';
import { Match } from '../models/match.model.js';
import { ratingOf, User } from '../models/user.model.js';
import { signToken } from '../utils/jwt.js';
import type { RankedTiming } from '../utils/rankedConfig.js';
import type { Redis } from '../utils/redis.js';
import { queueEntries } from './matchmaking.js';
import type { RankedGameRoom } from './rankedGame.room.js';
import {
  carromMatchOf, carromRoom, fastTiming, SECRET, sleep, until, wrap, type ServerMessage, type TestClient,
} from './roomTestkit.js';

const rankedTiming: RankedTiming = { tickMs: 30, botOfferMs: 400, joinWaitMs: 3000 };

interface Queued { room: SdkRoom; inbox: QueueMessage[]; userId: string; token: string }

/** Each client plays its own turns with the medium bot. */
function autoPlay(c: TestClient, seat: number, seed: number): void {
  const next = (m: ServerMessage): { state: GameState; turnId: number } | null =>
    m.type === 'game' ? { state: m.view, turnId: m.turnId }
      : m.type === 'moveResult' || m.type === 'timeout' ? { state: m.view, turnId: m.turnId + 1 } : null;
  let s = seed;
  const act = (m: ServerMessage) => {
    const n = next(m);
    if (n && n.state.winner === null && n.state.turnSeat === seat) {
      c.send({ type: 'move', turnId: n.turnId, move: chooseShot(n.state, 'medium', s++) });
    }
  };
  c.room.onMessage(MSG, act);
  // The game may already have started: act on the last message seen so far.
  const last = [...c.inbox].reverse().find((m) => next(m) !== null);
  if (last) act(last);
}

describe('ranked queue and rooms', () => {
  let colyseus: ColyseusTestServer;
  const redis = new RedisMock() as unknown as Redis;
  const open: SdkRoom[] = [];

  beforeAll(async () => {
    await connectDb(inject('mongoUri'));
    await Match.init();
    const { gameServer } = createServer(
      { CORS_ORIGIN: [], NODE_ENV: 'test', JWT_SECRET: SECRET, GOOGLE_CLIENT_IDS: [] },
      { roomTiming: fastTiming(), redis, rankedTiming },
    );
    colyseus = await boot(gameServer);
  });
  afterEach(async () => {
    await Promise.all(open.splice(0).map((r) => r.leave().catch(() => {})));
    // A ranked room left mid-game writes an abandon result; let it land before the wipe.
    await sleep(150);
    await colyseus.cleanup();
    await Promise.all([User.deleteMany({}), Match.deleteMany({}), redis.flushall()]);
  });
  afterAll(async () => {
    await colyseus.shutdown();
    await disconnectDb();
  });

  async function user(name: string, rating = 1000): Promise<{ userId: string; token: string }> {
    const u = await User.create({ name, ratings: { carrom: { rating, games: 0 } } });
    return { userId: u.id as string, token: signToken(u.id as string, SECRET) };
  }

  async function queue(name: string, rating = 1000): Promise<Queued> {
    const u = await user(name, rating);
    colyseus.sdk.auth.token = u.token;
    const room = await colyseus.sdk.joinOrCreate(QUEUE_ROOM, { gameId: 'carrom' });
    room.reconnection.enabled = false;
    open.push(room);
    const inbox: QueueMessage[] = [];
    room.onMessage(MSG, (raw: unknown) => {
      const m = parseQueueMessage(raw);
      if (m) inbox.push(m);
    });
    return { room, inbox, ...u };
  }

  const reservationOf = async (q: Queued, ms = 5000): Promise<SeatReservation> => {
    await until(() => q.inbox.some((m) => m.type === 'matched'), ms);
    const m = q.inbox.find((x) => x.type === 'matched');
    if (m?.type !== 'matched') throw new Error('not matched');
    return m.reservation;
  };

  async function enter(q: Queued, r: SeatReservation): Promise<TestClient> {
    colyseus.sdk.auth.token = q.token;
    const room = await colyseus.sdk.consumeSeatReservation(r);
    room.reconnection.enabled = false;
    open.push(room);
    return wrap(room);
  }

  /** Two players queue, get matched, and both enter the ranked room. */
  async function matchedPair(ra = 1000, rb = 1000) {
    const a = await queue('Anik', ra);
    const b = await queue('Bina', rb);
    const [resA, resB] = await Promise.all([reservationOf(a), reservationOf(b)]);
    expect(resA.roomId).toBe(resB.roomId);
    const ca = await enter(a, resA);
    const cb = await enter(b, resB);
    await Promise.all([ca.waitFor('game'), cb.waitFor('game')]);
    const room = colyseus.getRoomById(resA.roomId) as unknown as RankedGameRoom;
    return { a, b, ca, cb, room };
  }

  const rating = async (id: string) => ratingOf((await User.findById(id))!, 'carrom').rating;

  it('RANK-2 two players within the window are matched into one ranked 1v1 room', async () => {
    const { a, b, room } = await matchedPair(1000, 1090);
    expect(room.state.ranked).toBe(true);
    expect(room.state.phase).toBe('playing');
    const seats = Object.fromEntries([...room.state.players.values()].map((p) => [p.userId, p.seat]));
    expect(seats).toEqual({ [a.userId]: 0, [b.userId]: 2 });
    expect(carromMatchOf(room).state.config).toMatchObject({ format: '1v1', preset: 'colour', length: { kind: 'board' } });
    expect(await queueEntries(redis, 'carrom')).toEqual([]);
  });

  it('RANK-2 far ratings wait; queue status shows the window; cancel leaves the queue', async () => {
    const a = await queue('Anik', 1000);
    const b = await queue('Bina', 1300);
    await until(() => a.inbox.filter((m) => m.type === 'queue').length >= 3);
    const status = a.inbox.find((m) => m.type === 'queue');
    expect(status).toMatchObject({ type: 'queue', window: 100, rating: 1000 });
    expect(a.inbox.some((m) => m.type === 'matched')).toBe(false);
    expect((await queueEntries(redis, 'carrom')).map((e) => e.userId).sort()).toEqual([a.userId, b.userId].sort());
    await b.room.leave();
    await until(() => !colyseus.getRoomById(a.room.roomId)?.clients.some((c) => c.sessionId === b.room.sessionId));
    await sleep(50);
    expect((await queueEntries(redis, 'carrom')).map((e) => e.userId)).toEqual([a.userId]);
  });

  it('RANK-2 one queue entry per user', async () => {
    const a = await queue('Anik');
    colyseus.sdk.auth.token = a.token;
    await expect(colyseus.sdk.joinOrCreate(QUEUE_ROOM, { gameId: 'carrom' })).rejects.toBeDefined();
    // HUB-6 no queue for an unknown game.
    await expect(colyseus.sdk.joinOrCreate(QUEUE_ROOM, { gameId: 'chess' })).rejects.toBeDefined();
  });

  it('RANK-3 an unmatched player is offered a bot game after the wait, once', async () => {
    const a = await queue('Anik');
    await sleep(rankedTiming.botOfferMs / 2);
    expect(a.inbox.some((m) => m.type === 'botOffer')).toBe(false);
    await until(() => a.inbox.some((m) => m.type === 'botOffer'));
    await sleep(100);
    expect(a.inbox.filter((m) => m.type === 'botOffer')).toHaveLength(1);
  });

  it('RANK-3 an unranked (private room) game changes no rating and writes no Match', async () => {
    const x = await user('Xena');
    const y = await user('Yusuf');
    const created = await colyseus.createRoom(GAME_ROOM, carromRoom());
    colyseus.sdk.auth.token = x.token;
    const cx = wrap(await colyseus.sdk.joinById(created.roomId));
    colyseus.sdk.auth.token = y.token;
    const cy = wrap(await colyseus.sdk.joinById(created.roomId));
    open.push(cx.room, cy.room);
    autoPlay(cx, 0, 1);
    autoPlay(cy, 2, 1000);
    cx.send({ type: 'start' });
    const over = (m: Extract<ServerMessage, { type: 'moveResult' }>) => m.view.winner !== null;
    await cx.waitFor('moveResult', over, 60_000);
    await sleep(200);
    expect([await rating(x.userId), await rating(y.userId)]).toEqual([1000, 1000]);
    expect(await Match.countDocuments()).toBe(0);
    expect(cx.inbox.some((m) => m.type === 'rankedResult')).toBe(false);
  }, 70_000);

  it('RANK-4 HUB-7 a finished ranked game sends rankedResult and applies carrom ratings exactly once', async () => {
    const { a, b, ca, cb, room } = await matchedPair();
    autoPlay(ca, 0, 7);
    autoPlay(cb, 2, 7000);
    const [ra, rb] = await Promise.all([ca.waitFor('rankedResult', undefined, 60_000), cb.waitFor('rankedResult', undefined, 60_000)]);
    expect(ra).toEqual(rb);
    expect(ra.abandoned).toBe(false);
    expect(ra.winner).toBe(carromMatchOf(room).state.winner);
    const winnerId = ra.winner === 'A' ? a.userId : b.userId;
    const loserId = ra.winner === 'A' ? b.userId : a.userId;
    expect([await rating(winnerId), await rating(loserId)]).toEqual([1016, 984]);
    // Game end handled again (a retry): nothing changes.
    (room as unknown as { onGameEnd(w: string): void }).onGameEnd(ra.winner);
    await room.pendingResult;
    expect([await rating(winnerId), await rating(loserId)]).toEqual([1016, 984]);
    expect(await Match.countDocuments({ matchId: room.roomId, ranked: true, game: 'carrom' })).toBe(1);
    // HUB-7 only the carrom rating moved, and one ranked carrom game counted.
    const w = (await User.findById(winnerId))!;
    expect(ratingOf(w, 'carrom').games).toBe(1);
    expect([...w.ratings.keys()]).toEqual(['carrom']);
  }, 70_000);

  it('RANK-4 leaving a ranked game and not coming back is a loss', async () => {
    const { a, b, ca, cb, room } = await matchedPair();
    await ca.room.leave();
    const res = await cb.waitFor('rankedResult');
    expect(res).toMatchObject({ winner: 'B', abandoned: true });
    await room.pendingResult;
    expect([await rating(a.userId), await rating(b.userId)]).toEqual([984, 1016]);
    const m = (await Match.findOne({ matchId: room.roomId }))!;
    expect(m.abandoned).toBe(true);
    expect(m.winner).toBe('B');
  });

  it('COS-2 ranked: a finished game rewards both; an abandon rewards only the one who stayed', async () => {
    const { a, b, ca, room } = await matchedPair();
    await ca.room.leave();
    await until(() => room.pendingRewards !== null);
    await room.pendingRewards;
    const coins = async (id: string) => (await User.findById(id))!.coins;
    expect([await coins(a.userId), await coins(b.userId)]).toEqual([0, 30]);
  });

  it('RANK-2 only the matchmaker makes ranked rooms; strangers cannot take a reserved seat', async () => {
    const x = await user('Xena');
    colyseus.sdk.auth.token = x.token;
    await expect(colyseus.sdk.create(RANKED_ROOM, { key: 'guess', gameId: 'carrom', players: [x.userId, x.userId] })).rejects.toBeDefined();
    const { room } = await matchedPair();
    colyseus.sdk.auth.token = x.token;
    await expect(colyseus.sdk.joinById(room.roomId)).rejects.toBeDefined();
  });

  it('RANK-2 a matched player who never joins: the room closes without a result', async () => {
    const a = await queue('Anik');
    const b = await queue('Bina');
    const resA = await reservationOf(a);
    await reservationOf(b);
    const ca = await enter(a, resA);
    const err = await ca.waitFor('error', (m) => m.code === 'NO_OPPONENT', rankedTiming.joinWaitMs + 2000);
    expect(err.code).toBe('NO_OPPONENT');
    expect(await Match.countDocuments({ matchId: resA.roomId })).toBe(0);
  });
});
