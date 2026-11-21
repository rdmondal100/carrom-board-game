import { boot, type ColyseusTestServer } from '@colyseus/testing';
import type { Room as SdkRoom } from '@colyseus/sdk';
import RedisMock from 'ioredis-mock';
import { GAME_ROOM, MSG, parseQueueMessage, QUEUE_ROOM, type QueueMessage, type SeatReservation, type ServerMessage as AnyMessage } from '@carrom/protocol';
import { DEFAULT_LUDO_CONFIG, ludoBot, type LudoEvent, type LudoMove, type LudoState, type LudoView } from '@hub/ludo';
import { afterAll, afterEach, beforeAll, describe, expect, inject, it } from 'vitest';
import { createServer } from '../app.js';
import { connectDb, disconnectDb } from '../connectDb.js';
import { Match } from '../models/match.model.js';
import { ratingOf, User } from '../models/user.model.js';
import { signToken } from '../utils/jwt.js';
import type { RankedTiming } from '../utils/rankedConfig.js';
import type { Redis } from '../utils/redis.js';
import { fastTiming, SECRET, seatOf, sleep, until, wrap, type TestClient } from './roomTestkit.js';

type LudoMessage = AnyMessage<LudoView, LudoEvent, LudoMove>;
const rankedTiming: RankedTiming = { tickMs: 30, botOfferMs: 60_000, joinWaitMs: 3000 };

/** After this message: the game on screen and the turnId the next move must carry. */
function nextTurn(m: LudoMessage): { view: LudoView; turnId: number } | null {
  if (m.type === 'game') return { view: m.view, turnId: m.turnId };
  if (m.type === 'moveResult' || m.type === 'timeout') return { view: m.view, turnId: m.turnId + 1 };
  return null;
}

/** The client plays its own seat with the hard bot (the bot reads only the view). */
function autoPlay(c: TestClient, seat: number): void {
  let seed = seat * 1000;
  const act = (raw: unknown) => {
    const n = nextTurn(raw as LudoMessage);
    if (!n || n.view.winner !== null || n.view.turnSeat !== seat) return;
    c.send({ type: 'move', turnId: n.turnId, move: ludoBot(n.view as LudoState, seat, 'hard', seed++) });
  };
  c.room.onMessage(MSG, act);
  const last = [...c.inbox].reverse().find((m) => nextTurn(m as unknown as LudoMessage) !== null);
  if (last) act(last);
}

describe('ludo through the shared rooms (LUDO-7)', () => {
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
    await sleep(150);
    await colyseus.cleanup();
    await Promise.all([User.deleteMany({}), Match.deleteMany({}), redis.flushall()]);
  });
  afterAll(async () => {
    await colyseus.shutdown();
    await disconnectDb();
  });

  async function user(name: string): Promise<{ userId: string; token: string }> {
    const u = await User.create({ name, isGuest: true });
    return { userId: u.id as string, token: signToken(u.id as string, SECRET) };
  }

  it('LUDO-7 a scripted 4-player Ludo game runs to its end through the shared room', async () => {
    const room = await colyseus.createRoom(GAME_ROOM, { gameId: 'ludo', config: { ...DEFAULT_LUDO_CONFIG, players: 4 } });
    const players: TestClient[] = [];
    for (const name of ['Anik', 'Bina', 'Chayan', 'Dola']) {
      colyseus.sdk.auth.token = (await user(name)).token;
      const r = await colyseus.sdk.joinById(room.roomId);
      r.reconnection.enabled = false;
      open.push(r);
      players.push(wrap(r));
    }
    const seats = players.map((c) => seatOf(colyseus, c));
    expect([...seats].sort()).toEqual([0, 1, 2, 3]);
    players.forEach((c, i) => autoPlay(c, seats[i]!));
    players[0]!.send({ type: 'start' });

    const isEnd = (m: { view: unknown }) => (m.view as LudoView).winner !== null;
    const ends = await Promise.all(players.map((c) => c.waitFor('moveResult', isEnd, 110_000)));
    const winner = (ends[0]!.view as unknown as LudoView).winner;
    expect(['0', '1', '2', '3']).toContain(winner);
    const results = (c: TestClient) => c.inbox.filter((m) => m.type === 'moveResult');
    const ids = results(players[0]!).map((m) => m.turnId);
    expect(ids).toEqual(ids.map((_, i) => i));
    for (const c of players) {
      expect(results(c).map((m) => m.hash)).toEqual(results(players[0]!).map((m) => m.hash));
      expect(c.inbox.some((m) => m.type === 'error' || m.type === 'timeout')).toBe(false);
    }
    await until(() => (colyseus.getRoomById(room.roomId) as unknown as { state: { phase: string } }).state.phase === 'ended');
  }, 120_000);

  it('LUDO-7 ranked Ludo: queue → 1v1 room → result moves ratings.ludo only', async () => {
    const queue = async (name: string) => {
      const u = await user(name);
      colyseus.sdk.auth.token = u.token;
      const room = await colyseus.sdk.joinOrCreate(QUEUE_ROOM, { gameId: 'ludo' });
      room.reconnection.enabled = false;
      open.push(room);
      const inbox: QueueMessage[] = [];
      room.onMessage(MSG, (raw: unknown) => {
        const m = parseQueueMessage(raw);
        if (m) inbox.push(m);
      });
      return { ...u, inbox };
    };
    const reservation = async (q: { inbox: QueueMessage[] }): Promise<SeatReservation> => {
      await until(() => q.inbox.some((m) => m.type === 'matched'), 5000);
      const m = q.inbox.find((x) => x.type === 'matched');
      if (m?.type !== 'matched') throw new Error('not matched');
      return m.reservation;
    };
    const a = await queue('Anik');
    const b = await queue('Bina');
    const clients: TestClient[] = [];
    for (const q of [a, b]) {
      colyseus.sdk.auth.token = q.token;
      const r = await colyseus.sdk.consumeSeatReservation(await reservation(q));
      r.reconnection.enabled = false;
      open.push(r);
      clients.push(wrap(r));
    }
    const seats = clients.map((c) => seatOf(colyseus, c));
    expect([...seats].sort()).toEqual([0, 2]);
    clients.forEach((c, i) => autoPlay(c, seats[i]!));
    const [ra] = await Promise.all(clients.map((c) => c.waitFor('rankedResult', undefined, 60_000)));
    expect(ra!.abandoned).toBe(false);
    const winnerId = ra!.winner === String(seats[0]) ? a.userId : b.userId;
    const loserId = winnerId === a.userId ? b.userId : a.userId;
    await sleep(200);
    const w = (await User.findById(winnerId))!;
    const l = (await User.findById(loserId))!;
    expect([ratingOf(w, 'ludo').rating, ratingOf(l, 'ludo').rating]).toEqual([1016, 984]);
    expect(ratingOf(w, 'ludo').games).toBe(1);
    expect([...w.ratings.keys()]).toEqual(['ludo']);
    expect(await Match.countDocuments({ game: 'ludo', ranked: true })).toBe(1);
  }, 70_000);
});
