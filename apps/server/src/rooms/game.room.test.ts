import { boot, type ColyseusTestServer } from '@colyseus/testing';
import { simulateShot, stateHash, type ShotInput } from '@carrom/engine';
import type { LobbyView } from '@carrom/protocol';
import { applyShot } from '@carrom/rules';
import { afterAll, afterEach, beforeAll, describe, expect, inject, it } from 'vitest';
import { createServer } from '../app.js';
import { connectDb, disconnectDb } from '../connectDb.js';
import { User } from '../models/user.model.js';
import {
  carromMatchOf, carromRoom, fastTiming, join, makeUser, SECRET, seatOf, serverRoom, until, wrap, type TestClient,
} from './roomTestkit.js';

const timing = fastTiming();
const opts1v1 = carromRoom();
const straight = (seat: number): ShotInput => ({ seat: seat as ShotInput['seat'], x: 0, dirX: 0, dirY: 1, power: 0.6 });

describe('game room', () => {
  let colyseus: ColyseusTestServer;
  const clients: TestClient[] = [];

  beforeAll(async () => {
    await connectDb(inject('mongoUri'));
    const { gameServer } = createServer(
      { CORS_ORIGIN: ['http://localhost:5173'], NODE_ENV: 'test', JWT_SECRET: SECRET, GOOGLE_CLIENT_IDS: [] },
      { roomTiming: timing },
    );
    colyseus = await boot(gameServer);
  });
  afterEach(async () => {
    Object.assign(timing, fastTiming());
    await Promise.all(clients.splice(0).map((c) => c.room.leave().catch(() => {})));
    await colyseus.cleanup();
    await User.deleteMany({});
  });
  afterAll(async () => {
    await colyseus.shutdown();
    await disconnectDb();
  });

  async function joinAs(roomId: string, name: string): Promise<TestClient> {
    const c = await join(colyseus, roomId, await makeUser(name));
    clients.push(c);
    return c;
  }

  /** A 1v1 room with both players in and the game started. */
  async function started1v1() {
    const room = await colyseus.createRoom('game', opts1v1);
    const host = await joinAs(room.roomId, 'Host');
    const guest = await joinAs(room.roomId, 'Guest');
    host.send({ type: 'start' });
    const game = await host.waitFor('game');
    await guest.waitFor('game');
    const bySeat = (s: number) => (seatOf(colyseus, host) === s ? host : guest);
    return { room: serverRoom(colyseus, room.roomId), host, guest, game, bySeat };
  }

  it('ROOM-1 create → code; /rooms/:code finds it; unknown code 404', async () => {
    colyseus.sdk.auth.token = await makeUser('Maker');
    const sdkRoom = await colyseus.sdk.create('game', opts1v1);
    sdkRoom.reconnection.enabled = false;
    clients.push({ room: sdkRoom } as TestClient);
    const code = serverRoom(colyseus, sdkRoom.roomId).state.code;
    expect(code).toMatch(/^[A-HJ-NP-Z2-9]{6}$/);
    const found = await colyseus.http.get(`/rooms/${code.toLowerCase()}`);
    expect(found.statusCode).toBe(200);
    expect(found.data).toEqual({ roomId: sdkRoom.roomId });
    await expect(colyseus.http.get('/rooms/ZZZZZZ')).rejects.toMatchObject({ statusCode: 404 });
    await expect(colyseus.http.get('/rooms/O0O0O0')).rejects.toMatchObject({ statusCode: 404 });
  });

  it('ROOM-1 HUB-4 bad create options are refused (old shape, bad config, unknown game)', async () => {
    colyseus.sdk.auth.token = await makeUser('Maker');
    await expect(colyseus.sdk.create('game', { format: '1v1', preset: 'colour', length: { kind: 'board' } })).rejects.toBeDefined();
    await expect(colyseus.sdk.create('game', carromRoom({ format: '3v3' as '1v1' }))).rejects.toBeDefined();
    await expect(colyseus.sdk.create('game', { gameId: 'chess', config: {} })).rejects.toBeDefined();
  });

  it('ROOM-2 join without token rejected; guest token accepted', async () => {
    const room = await colyseus.createRoom('game', opts1v1);
    // A room with nobody in it closes, so the guest goes first.
    const ok = await joinAs(room.roomId, 'Guesty');
    await expect(join(colyseus, room.roomId)).rejects.toBeDefined();
    await expect(join(colyseus, room.roomId, 'not-a-jwt')).rejects.toBeDefined();
    expect(serverRoom(colyseus, room.roomId).state.players.get(ok.room.sessionId)?.name).toBe('Guesty');
  });

  it('ROOM-3 seats fill in join order; host swaps and starts only when full', async () => {
    const room = await colyseus.createRoom('game', carromRoom({ format: '2v2' }));
    const a = await joinAs(room.roomId, 'Anna');
    const b = await joinAs(room.roomId, 'Babu');
    expect([seatOf(colyseus, a), seatOf(colyseus, b)]).toEqual([0, 1]);
    a.send({ type: 'start' });
    await a.waitFor('error', (e) => e.code === 'NOT_FULL');
    b.send({ type: 'swap', a: 0, b: 2 });
    await b.waitFor('error', (e) => e.code === 'NOT_ALLOWED');
    a.send({ type: 'swap', a: 0, b: 2 });
    await until(() => seatOf(colyseus, a) === 2);
    const c = await joinAs(room.roomId, 'Chandni');
    const d = await joinAs(room.roomId, 'Dipu');
    expect([seatOf(colyseus, c), seatOf(colyseus, d)]).toEqual([0, 3]);
    b.send({ type: 'start' });
    await b.waitFor('error', (e) => e.code === 'NOT_ALLOWED');
    a.send({ type: 'start' });
    await d.waitFor('game');
    expect(serverRoom(colyseus, room.roomId).state.phase).toBe('playing');
    // The client reads the synced state as protocol LobbyView via toJSON().
    await until(() => (d.room.state as { phase?: string }).phase === 'playing');
    const view = (d.room.state as { toJSON(): LobbyView }).toJSON();
    expect(view).toMatchObject({ phase: 'playing', gameId: 'carrom', hostId: a.room.sessionId });
    expect(JSON.parse(view.config)).toEqual({ format: '2v2', preset: 'colour', length: { kind: 'board' } });
    expect(view.players[d.room.sessionId]).toMatchObject({ name: 'Dipu', seat: 3, ready: true, bot: false, left: false });
  });

  it('ROOM-4 out-of-turn, stale turnId and bad move → error, state unchanged', async () => {
    const { room, game, bySeat } = await started1v1();
    const turn = game.view.turnSeat;
    const other = turn === 0 ? 2 : 0;
    const before = JSON.stringify(room.match);
    bySeat(other).send({ type: 'move', turnId: 0, move: straight(other) });
    await bySeat(other).waitFor('error', (e) => e.code === 'NOT_YOUR_TURN');
    bySeat(turn).send({ type: 'move', turnId: 5, move: straight(turn) });
    await bySeat(turn).waitFor('error', (e) => e.code === 'STALE_TURN');
    bySeat(turn).send({ type: 'move', turnId: 0, move: { ...straight(turn), power: 9 } });
    await bySeat(turn).waitFor('error', (e) => e.code === 'BAD_MOVE');
    bySeat(turn).send({ type: 'shot', turnId: 0, input: straight(turn) });
    await bySeat(turn).waitFor('error', (e) => e.code === 'BAD_MESSAGE');
    expect(JSON.stringify(room.match)).toBe(before);
  });

  it('ROOM-5 server hash equals a local simulateShot + applyShot of the same input', async () => {
    const { host, guest, game, bySeat } = await started1v1();
    const input = { ...straight(game.view.turnSeat), x: 0.07, dirX: 0.28, dirY: 0.96 };
    bySeat(input.seat).send({ type: 'move', turnId: 0, move: input });
    const res = await host.waitFor('moveResult');
    await guest.waitFor('moveResult');
    const sim = simulateShot(game.view.board, input);
    const local = applyShot(game.view, sim.events, sim.final);
    expect(res.hash).toBe(stateHash(local.state.board));
    expect(res.durationMs).toBe(sim.durationMs);
    expect(res.view).toEqual(JSON.parse(JSON.stringify(local.state)));
    expect(res.events).toEqual(JSON.parse(JSON.stringify(local.events)));
    expect(res.move).toEqual(input);
  });

  it('ROOM-6 aim hint is relayed to others, at most 10 per second', async () => {
    const { game, bySeat } = await started1v1();
    const turn = game.view.turnSeat;
    const watcher = bySeat(turn === 0 ? 2 : 0);
    const aim = { x: 0.1, dirX: 0, dirY: 1, power: 0.5 };
    bySeat(turn).send({ type: 'hint', data: aim });
    bySeat(turn).send({ type: 'hint', data: { ...aim, power: 0.6 } });
    // Not the shooter's turn, or not a valid aim: dropped.
    watcher.send({ type: 'hint', data: aim });
    bySeat(turn).send({ type: 'hint', data: { ...aim, dirY: 2 } });
    await watcher.waitFor('hint', (m) => m.seat === turn && m.data.power === 0.5);
    await new Promise((r) => setTimeout(r, 150));
    expect(watcher.inbox.filter((m) => m.type === 'hint')).toHaveLength(1);
    expect(bySeat(turn).inbox.some((m) => m.type === 'hint')).toBe(false);
  });

  it('ROOM-7 timeout passes the turn; two timeouts → bot shoots for that seat', async () => {
    timing.shotClockMs = 150;
    const { room, host, game } = await started1v1();
    const first = game.view.turnSeat;
    const t0 = await host.waitFor('timeout', (m) => m.turnId === 0);
    expect(t0.seat).toBe(first);
    expect(t0.view.turnSeat).not.toBe(first);
    const t2 = await host.waitFor('timeout', (m) => m.turnId === 2);
    expect(t2.events).toContainEqual({ type: 'botTakeover', seat: first });
    expect(room.botSeats.has(first)).toBe(true);
    // The other seat times out once more; then the bot plays `first`.
    const shot = await host.waitFor('moveResult', (m) => m.seat === first, 15_000);
    expect(shot.turnId).toBe(4);
  });

  it('ROOM-7 any message from a taken-over player ends the takeover', async () => {
    timing.shotClockMs = 150;
    const { room, host, game, bySeat } = await started1v1();
    const first = game.view.turnSeat;
    await host.waitFor('timeout', (m) => m.turnId === 2);
    timing.shotClockMs = 60_000;
    bySeat(first).send({ type: 'emote', id: 'oops' });
    await until(() => !room.botSeats.has(first));
  });

  it('ROOM-8 reconnect within the window keeps the seat and resyncs', async () => {
    const { room, guest } = await started1v1();
    const seat = seatOf(colyseus, guest);
    const token = guest.room.reconnectionToken;
    await guest.room.leave(false);
    await until(() => room.state.players.get(guest.room.sessionId)?.ready === false);
    const back = await colyseus.sdk.reconnect(token);
    back.reconnection.enabled = false;
    const again = wrap(back);
    clients.push(again);
    expect(back.sessionId).toBe(guest.room.sessionId);
    await until(() => room.state.players.get(back.sessionId)?.ready === true);
    expect(room.state.players.get(back.sessionId)?.seat).toBe(seat);
    expect(room.botSeats.size).toBe(0);
    await again.waitFor('game');
  });

  it('ROOM-8 after the window the bot keeps the seat and the other player is told', async () => {
    timing.reconnectS = 0.3;
    const { room, guest, host } = await started1v1();
    const seat = seatOf(colyseus, guest);
    await guest.room.leave(false);
    await until(() => room.state.players.get(guest.room.sessionId)?.left === true, 5000);
    expect(room.botSeats.has(seat)).toBe(true);
    expect(room.state.players.get(guest.room.sessionId)?.bot).toBe(true);
    expect(room.state.phase).toBe('playing');
    // The host still plays: the synced state they see marks the seat as left.
    await until(() => host.room.state.players.get(guest.room.sessionId)?.left === true);
  });

  it('ROOM-9 rematch needs all human votes, then the next seat breaks', async () => {
    const { room, host, guest } = await started1v1();
    const m = carromMatchOf(room);
    room.match = { ...m, state: { ...m.state, winner: 'A' } };
    room.state.phase = 'ended';
    host.send({ type: 'rematch' });
    await until(() => room.state.players.get(host.room.sessionId)?.rematch === true);
    expect(room.state.phase).toBe('ended');
    guest.send({ type: 'rematch' });
    const next = await host.waitFor('game', (g) => g.view.winner === null && g !== host.inbox.find((x) => x.type === 'game'));
    expect(next.turnId).toBe(0);
    expect(next.view.turnSeat).toBe(m.firstBreak === 0 ? 2 : 0);
    expect(room.state.phase).toBe('playing');
  });

  it('ROOM-10 emotes go to everyone, one per 2 s per player', async () => {
    const { host, guest } = await started1v1();
    host.send({ type: 'emote', id: 'wow' });
    host.send({ type: 'emote', id: 'gg' });
    await guest.waitFor('emote', (e) => e.id === 'wow');
    await host.waitFor('error', (e) => e.code === 'TOO_FAST');
    expect(guest.inbox.some((m) => m.type === 'emote' && m.id === 'gg')).toBe(false);
    host.send({ type: 'emote', id: 'hello' });
    await host.waitFor('error', (e) => e.code === 'BAD_MESSAGE');
  });
});
