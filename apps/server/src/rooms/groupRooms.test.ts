import { boot, type ColyseusTestServer } from '@colyseus/testing';
import type { Room as SdkRoom } from '@colyseus/sdk';
import request from 'supertest';
import { LOUNGE_ROOM, MSG, type GroupLeaderboardResponse, type GroupView, type PresenceResponse, type StartGroupRoomResponse } from '@carrom/protocol';
import { toyGame, toyGame2 } from '@hub/game-kit/testkit';
import { afterAll, afterEach, beforeAll, describe, expect, inject, it } from 'vitest';
import { createApp, createServer, type AppEnv } from '../app.js';
import { connectDb, disconnectDb } from '../connectDb.js';
import { Group } from '../models/group.model.js';
import { GroupMember } from '../models/groupMember.model.js';
import { Match } from '../models/match.model.js';
import { User } from '../models/user.model.js';
import { registerGroupConfig } from '../utils/groupConfig.js';
import { signToken } from '../utils/jwt.js';
import { memoryPresence } from '../utils/presence.js';
import type { GameRoom } from './game.room.js';
import { registerGame, unregisterGame } from './games.js';
import type { LoungeRoom } from './lounge.room.js';
import { fastTiming, join, SECRET, seatOf, serverRoom, sleep, until, wrap, type TestClient } from './roomTestkit.js';

const env: AppEnv = { CORS_ORIGIN: [], NODE_ENV: 'test', JWT_SECRET: SECRET, GOOGLE_CLIENT_IDS: [] };
const presence = memoryPresence();
const app = createApp(env, { authRateLimit: 10_000, presence });
const auth = (id: string) => `Bearer ${signToken(id, SECRET)}`;

describe('ADDA-3..5 group rooms and lounge', () => {
  let colyseus: ColyseusTestServer;
  const open: SdkRoom[] = [];

  beforeAll(async () => {
    registerGame(toyGame);
    registerGame(toyGame2);
    registerGroupConfig('toy', () => ({ hidden: false }));
    registerGroupConfig('toy2', () => ({ hidden: false }));
    await connectDb(inject('mongoUri'));
    const { gameServer } = createServer(env, { roomTiming: fastTiming(), presence });
    colyseus = await boot(gameServer);
  });
  afterEach(async () => {
    await Promise.all(open.splice(0).map((r) => r.leave().catch(() => {})));
    await colyseus.cleanup();
    await Promise.all([User.deleteMany({}), Group.deleteMany({}), GroupMember.deleteMany({}), Match.deleteMany({})]);
  });
  afterAll(async () => {
    unregisterGame(toyGame.id);
    unregisterGame(toyGame2.id);
    registerGroupConfig('toy', null);
    registerGroupConfig('toy2', null);
    await colyseus.shutdown();
    await disconnectDb();
  });

  /** A group whose members are these names (the first is the owner); returns its id and the user ids. */
  async function makeGroup(...names: string[]): Promise<{ gid: string; ids: string[] }> {
    const ids = (await User.insertMany(names.map((name) => ({ name })))).map((u) => u.id as string);
    const g = await Group.create({ name: 'Adda', code: 'ABCDEFGH', ownerId: ids[0], members: ids.length });
    const gid = g.id as string;
    await GroupMember.insertMany(ids.map((userId, i) => ({ groupId: gid, userId, role: i === 0 ? 'owner' : 'member' })));
    return { gid, ids };
  }

  async function joinAs(roomId: string, userId: string): Promise<TestClient> {
    const c = await join(colyseus, roomId, signToken(userId, SECRET));
    open.push(c.room);
    return c;
  }

  async function startRoom(gid: string, by: string, gameId = 'toy'): Promise<StartGroupRoomResponse> {
    const res = await request(app).post(`/groups/${gid}/rooms`).set('Authorization', auth(by)).send({ gameId, players: 2 });
    expect(res.status).toBe(201);
    return res.body as StartGroupRoomResponse;
  }

  /** Play the toy game (cells in order) to its end; returns the winning seat. */
  async function playOut(roomId: string, a: TestClient, b: TestClient): Promise<void> {
    a.send({ type: 'start' });
    await a.waitFor('game');
    const room = serverRoom(colyseus, roomId);
    for (let turnId = 0; room.state.phase === 'playing'; turnId++) {
      const m = room.match as { cells: number[]; turn: number };
      const seat = toyGame.turnSeat(m as never);
      (seatOf(colyseus, a) === seat ? a : b).send({ type: 'move', turnId, move: { cell: m.cells.indexOf(-1) } });
      await a.waitFor('moveResult', (x) => x.turnId === turnId);
    }
    await until(() => room.state.phase === 'ended');
  }

  it('ADDA-3 start a room: online members get a notice; its games are recorded for the group page and leaderboard', async () => {
    const { gid, ids: [anik = '', bina = '', cara = '', dipu = ''] } = await makeGroup('Anik', 'Bina', 'Cara', 'Dipu');
    await presence.beat(cara, null);
    await presence.take(dipu);
    const r = await startRoom(gid, anik);
    expect(r.code).toMatch(/^[A-Z2-9]{6}$/);
    const notices = ((await request(app).post('/presence').set('Authorization', auth(cara)).send({ game: null })).body as PresenceResponse).notices;
    expect(notices).toEqual([expect.objectContaining({ kind: 'groupRoom', groupId: gid, gameId: 'toy', code: r.code, from: expect.objectContaining({ name: 'Anik' }) })]);
    expect(await presence.take(dipu)).toEqual([]); // offline: no notice

    const a = await joinAs(r.roomId, anik);
    const b = await joinAs(r.roomId, bina);
    expect(a.room.state.groupId).toBe(gid);
    await playOut(r.roomId, a, b);
    await serverRoom(colyseus, r.roomId).group.saving;

    const page = (await request(app).get(`/groups/${gid}`).set('Authorization', auth(cara))).body as GroupView;
    expect(page.matches).toHaveLength(1);
    expect(page.matches[0]).toMatchObject({ game: 'toy', ranked: false });
    const board = (await request(app).get(`/groups/${gid}/leaderboard?game=toy`).set('Authorization', auth(cara))).body as GroupLeaderboardResponse;
    expect(board.rows.map((x) => x.games)).toEqual([1, 1]);
    expect(board.rows.map((x) => x.wins).sort()).toEqual([0, 1]);
    // Ratings never change in group rooms.
    const m = await Match.findOne({ groupId: gid });
    expect(m?.players.every((p) => p.ratingBefore === p.ratingAfter)).toBe(true);
    // Non-members get nothing.
    const [eve = ''] = (await User.insertMany([{ name: 'Eve' }])).map((u) => u.id as string);
    expect((await request(app).post(`/groups/${gid}/rooms`).set('Authorization', auth(eve)).send({ gameId: 'toy', players: 2 })).status).toBe(404);
    expect((await request(app).get(`/groups/${gid}/leaderboard?game=toy`).set('Authorization', auth(eve))).status).toBe(404);
  });

  it('ADDA-3 a client cannot make its own group room (a made-up group key gives a plain room)', async () => {
    const { gid } = await makeGroup('Anik');
    const room = await colyseus.createRoom('game', { gameId: 'toy', config: { hidden: false }, group: { key: 'guess', id: gid } });
    expect((room as unknown as GameRoom).state.groupId).toBe('');
  });

  it('ADDA-4 next-game moves all present members to the new room', async () => {
    const { gid, ids: [anik = '', bina = ''] } = await makeGroup('Anik', 'Bina');
    const r = await startRoom(gid, anik);
    const a = await joinAs(r.roomId, anik);
    const b = await joinAs(r.roomId, bina);
    // Not before the game is over.
    a.send({ type: 'nextGame', gameId: 'toy2', players: 2 });
    await a.waitFor('error', (e) => e.code === 'NOT_ALLOWED');
    await playOut(r.roomId, a, b);

    b.send({ type: 'nextGame', gameId: 'nope', players: 2 });
    await b.waitFor('error', (e) => e.code === 'BAD_GAME');
    b.send({ type: 'nextGame', gameId: 'toy2', players: 2 });
    const [ma, mb] = await Promise.all([a.waitFor('nextRoom'), b.waitFor('nextRoom')]);
    expect(ma).toEqual(mb);
    expect(ma).toMatchObject({ gameId: 'toy2' });
    // Only one move per ended game.
    a.send({ type: 'nextGame', gameId: 'toy', players: 2 });
    await a.waitFor('error', (e) => e.code === 'NOT_ALLOWED');
    expect(a.inbox.filter((m) => m.type === 'nextRoom')).toHaveLength(1);

    await Promise.all([a.room.leave(), b.room.leave()]);
    const a2 = await joinAs(ma.roomId, anik);
    const b2 = await joinAs(ma.roomId, bina);
    const next = serverRoom(colyseus, ma.roomId);
    await until(() => next.state.players.size === 2);
    expect(next.state.gameId).toBe('toy2');
    expect(next.state.groupId).toBe(gid);
    expect(next.state.code).toBe(ma.code);
    await playOut(ma.roomId, a2, b2);
  });

  it('ADDA-4 a player who is not in the group cannot pick the next game', async () => {
    const { gid, ids: [anik = ''] } = await makeGroup('Anik');
    const [eve = ''] = (await User.insertMany([{ name: 'Eve' }])).map((u) => u.id as string);
    const r = await startRoom(gid, anik);
    const a = await joinAs(r.roomId, anik);
    const e = await joinAs(r.roomId, eve); // joined by the room code
    await playOut(r.roomId, a, e);
    e.send({ type: 'nextGame', gameId: 'toy2', players: 2 });
    await e.waitFor('error', (x) => x.code === 'NOT_ALLOWED');
    a.send({ type: 'nextGame', gameId: 'toy2', players: 2 });
    await e.waitFor('nextRoom');
  });

  it('ADDA-5 lounge: members only, one per group, at most 4, voice relayed between members', async () => {
    const { gid, ids } = await makeGroup('Anik', 'Bina', 'Cara', 'Dipu', 'Emon');
    const [outsider = ''] = (await User.insertMany([{ name: 'Eve' }])).map((u) => u.id as string);
    const enter = async (userId: string) => {
      colyseus.sdk.auth.token = signToken(userId, SECRET);
      const room = await colyseus.sdk.joinOrCreate(LOUNGE_ROOM, { groupId: gid });
      room.reconnection.enabled = false;
      open.push(room);
      return wrap(room);
    };
    const [a, b, c, d] = [await enter(ids[0]!), await enter(ids[1]!), await enter(ids[2]!), await enter(ids[3]!)];
    expect(new Set([a, b, c, d].map((x) => x.room.roomId)).size).toBe(1);
    await expect(enter(ids[4]!)).rejects.toThrow(/full/);
    await expect(enter(outsider)).rejects.toThrow(/members/);

    const lounge = colyseus.getRoomById(a.room.roomId) as unknown as LoungeRoom;
    const signal = { kind: 'offer', sdp: 'v=0' } as const;
    // Voice off: dropped.
    a.room.send(MSG, { type: 'voice', to: b.room.sessionId, signal });
    await sleep(50);
    expect(b.inbox).toEqual([]);
    a.room.send(MSG, { type: 'voiceState', on: true, muted: false });
    b.room.send(MSG, { type: 'voiceState', on: true, muted: true });
    await until(() => [...lounge.state.members.values()].filter((m) => m.voiceOn).length === 2);
    a.room.send(MSG, { type: 'voice', to: b.room.sessionId, signal });
    expect(await b.waitFor('voice')).toEqual({ type: 'voice', from: a.room.sessionId, signal });
    expect(c.inbox).toEqual([]);
    // Someone leaves: the fifth member gets in.
    await d.room.leave();
    await until(() => lounge.state.members.size === 3);
    await enter(ids[4]!);
  });
});
