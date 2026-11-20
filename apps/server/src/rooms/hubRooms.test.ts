import { boot, type ColyseusTestServer } from '@colyseus/testing';
import type { Room as SdkRoom } from '@colyseus/sdk';
import RedisMock from 'ioredis-mock';
import { MSG, parseQueueMessage, QUEUE_ROOM, type QueueMessage, type ServerMessage } from '@carrom/protocol';
import { hiddenToyGame, toyGame, type ToyView } from '@hub/game-kit/testkit';
import { afterAll, afterEach, beforeAll, describe, expect, inject, it } from 'vitest';
import { createServer } from '../app.js';
import { connectDb, disconnectDb } from '../connectDb.js';
import { User } from '../models/user.model.js';
import { signToken } from '../utils/jwt.js';
import type { RankedTiming } from '../utils/rankedConfig.js';
import type { Redis } from '../utils/redis.js';
import { registerGame, unregisterGame } from './games.js';
import { fastTiming, join, makeUser, SECRET, seatOf, serverRoom, sleep, until, type TestClient } from './roomTestkit.js';

type ToyMessage = ServerMessage<ToyView, unknown, { cell: number }>;
const rankedTiming: RankedTiming = { tickMs: 30, botOfferMs: 60_000, joinWaitMs: 3000 };

describe('hub rooms with toy games (HUB-4..6)', () => {
  let colyseus: ColyseusTestServer;
  const redis = new RedisMock() as unknown as Redis;
  const open: SdkRoom[] = [];

  beforeAll(async () => {
    registerGame(hiddenToyGame);
    registerGame(toyGame, { hidden: false });
    await connectDb(inject('mongoUri'));
    const { gameServer } = createServer(
      { CORS_ORIGIN: [], NODE_ENV: 'test', JWT_SECRET: SECRET, GOOGLE_CLIENT_IDS: [] },
      { roomTiming: fastTiming(), redis, rankedTiming },
    );
    colyseus = await boot(gameServer);
  });
  afterEach(async () => {
    await Promise.all(open.splice(0).map((r) => r.leave().catch(() => {})));
    await colyseus.cleanup();
    await Promise.all([User.deleteMany({}), redis.flushall()]);
  });
  afterAll(async () => {
    unregisterGame(hiddenToyGame.id);
    unregisterGame(toyGame.id);
    await colyseus.shutdown();
    await disconnectDb();
  });

  async function joinAs(roomId: string, name: string): Promise<TestClient> {
    const c = await join(colyseus, roomId, await makeUser(name));
    open.push(c.room);
    return c;
  }

  it('HUB-4 a room plays whichever registered game it was created for', async () => {
    const room = await colyseus.createRoom('game', { gameId: 'toy', config: { hidden: false } });
    const a = await joinAs(room.roomId, 'Anik');
    const b = await joinAs(room.roomId, 'Bina');
    expect(serverRoom(colyseus, room.roomId).maxClients).toBe(2);
    a.send({ type: 'start' });
    const game = (await a.waitFor('game')) as unknown as Extract<ToyMessage, { type: 'game' }>;
    const bySeat = (s: number) => (seatOf(colyseus, a) === s ? a : b);
    // Play cells 0..8 in order with whoever is on turn until the game ends.
    let turnSeat = game.view.turnSeat;
    for (let turnId = 0; ; turnId++) {
      const free = (serverRoom(colyseus, room.roomId).match as { cells: number[] }).cells.indexOf(-1);
      bySeat(turnSeat).send({ type: 'move', turnId, move: { cell: free } });
      const res = (await a.waitFor('moveResult', (m) => m.turnId === turnId)) as unknown as Extract<ToyMessage, { type: 'moveResult' }>;
      if (res.view.winner !== null || res.view.draw) break;
      turnSeat = res.view.turnSeat;
    }
    await until(() => serverRoom(colyseus, room.roomId).state.phase === 'ended');
  });

  it('HUB-5 a move that fails the game\'s schema → BAD_MOVE, nothing changes', async () => {
    const room = await colyseus.createRoom('game', { gameId: 'toy', config: { hidden: false } });
    const a = await joinAs(room.roomId, 'Anik');
    const b = await joinAs(room.roomId, 'Bina');
    a.send({ type: 'start' });
    const game = (await a.waitFor('game')) as unknown as Extract<ToyMessage, { type: 'game' }>;
    const mover = seatOf(colyseus, a) === game.view.turnSeat ? a : b;
    const before = JSON.stringify(serverRoom(colyseus, room.roomId).match);
    mover.send({ type: 'move', turnId: 0, move: { cell: 12 } });
    await mover.waitFor('error', (e) => e.code === 'BAD_MOVE');
    mover.send({ type: 'move', turnId: 0, move: { x: 0, dirX: 0, dirY: 1, power: 0.5, seat: 0 } });
    await sleep(50);
    expect(mover.inbox.filter((m) => m.type === 'error' && m.code === 'BAD_MOVE')).toHaveLength(2);
    // A game without hints drops them.
    mover.send({ type: 'hint', data: { anything: true } });
    await sleep(50);
    expect([...a.inbox, ...b.inbox].some((m) => m.type === 'hint')).toBe(false);
    expect(JSON.stringify(serverRoom(colyseus, room.roomId).match)).toBe(before);
  });

  it('HUB-5 hidden information: each client gets only its own view', async () => {
    const room = await colyseus.createRoom('game', { gameId: 'toyHidden', config: { hidden: true } });
    const a = await joinAs(room.roomId, 'Anik');
    const b = await joinAs(room.roomId, 'Bina');
    a.send({ type: 'start' });
    const [ga, gb] = (await Promise.all([a.waitFor('game'), b.waitFor('game')])) as unknown as Extract<ToyMessage, { type: 'game' }>[];
    const sa = seatOf(colyseus, a);
    const sb = seatOf(colyseus, b);
    const secrets = (serverRoom(colyseus, room.roomId).match as { secrets: number[] }).secrets;
    expect(ga!.view.secrets[sa]).toBe(secrets[sa]);
    expect(ga!.view.secrets[sb]).toBeNull();
    expect(gb!.view.secrets[sb]).toBe(secrets[sb]);
    expect(gb!.view.secrets[sa]).toBeNull();
    // Move results and a rejoin sync stay per seat too.
    const mover = ga!.view.turnSeat === sa ? a : b;
    mover.send({ type: 'move', turnId: 0, move: { cell: 4 } });
    const [ra, rb] = (await Promise.all([a.waitFor('moveResult'), b.waitFor('moveResult')])) as unknown as Extract<ToyMessage, { type: 'moveResult' }>[];
    expect(ra!.view.secrets[sb]).toBeNull();
    expect(rb!.view.secrets[sa]).toBeNull();
    expect(ra!.hash).toBe(rb!.hash);
  });

  it('HUB-6 queues never pair players across games', async () => {
    const queue = async (name: string, gameId: string) => {
      const u = await User.create({ name });
      colyseus.sdk.auth.token = signToken(u.id as string, SECRET);
      const room = await colyseus.sdk.joinOrCreate(QUEUE_ROOM, { gameId });
      room.reconnection.enabled = false;
      open.push(room);
      const inbox: QueueMessage[] = [];
      room.onMessage(MSG, (raw: unknown) => {
        const m = parseQueueMessage(raw);
        if (m) inbox.push(m);
      });
      return { room, inbox };
    };
    const carrom = await queue('Anik', 'carrom');
    const toy = await queue('Bina', 'toy');
    expect(carrom.room.roomId).not.toBe(toy.room.roomId);
    await until(() => toy.inbox.filter((m) => m.type === 'queue').length >= 3);
    expect([...carrom.inbox, ...toy.inbox].some((m) => m.type === 'matched')).toBe(false);
    // A second toy player joins the toy queue room and is matched with Bina, not Anik.
    const toy2 = await queue('Chayan', 'toy');
    expect(toy2.room.roomId).toBe(toy.room.roomId);
    await until(() => toy.inbox.some((m) => m.type === 'matched') && toy2.inbox.some((m) => m.type === 'matched'));
    await sleep(100);
    expect(carrom.inbox.some((m) => m.type === 'matched')).toBe(false);
  });
});
