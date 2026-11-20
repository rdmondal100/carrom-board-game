import { boot, type ColyseusTestServer } from '@colyseus/testing';
import type { LobbyView } from '@carrom/protocol';
import { afterAll, afterEach, beforeAll, describe, expect, inject, it } from 'vitest';
import { createServer } from '../app.js';
import { connectDb, disconnectDb } from '../connectDb.js';
import { User } from '../models/user.model.js';
import { ECONOMY } from '../utils/economyConfig.js';
import { signToken } from '../utils/jwt.js';
import { fastTiming, join, SECRET, seatOf, serverRoom, until, type TestClient } from './roomTestkit.js';

const opts1v1 = { format: '1v1', preset: 'colour', length: { kind: 'board' } };

describe('online rewards and skins', () => {
  let colyseus: ColyseusTestServer;
  const clients: TestClient[] = [];

  beforeAll(async () => {
    await connectDb(inject('mongoUri'));
    const { gameServer } = createServer(
      { CORS_ORIGIN: ['http://localhost:5173'], NODE_ENV: 'test', JWT_SECRET: SECRET, GOOGLE_CLIENT_IDS: [] },
      { roomTiming: fastTiming() },
    );
    colyseus = await boot(gameServer);
  });
  afterEach(async () => {
    await Promise.all(clients.splice(0).map((c) => c.room.leave().catch(() => {})));
    await colyseus.cleanup();
    await User.deleteMany({});
  });
  afterAll(async () => {
    await colyseus.shutdown();
    await disconnectDb();
  });

  async function player(name: string, owned: string[] = [], equipped: string[] = []) {
    const u = await User.create({ name, cosmetics: { owned, equipped } });
    return { id: u.id as string, token: signToken(u.id as string, SECRET) };
  }

  async function started1v1() {
    const a = await player('Anik', ['gold-striker', 'jade-coins'], ['gold-striker', 'jade-coins']);
    const b = await player('Bina');
    const created = await colyseus.createRoom('game', opts1v1);
    const ca = await join(colyseus, created.roomId, a.token);
    const cb = await join(colyseus, created.roomId, b.token);
    clients.push(ca, cb);
    ca.send({ type: 'start' });
    await Promise.all([ca.waitFor('game'), cb.waitFor('game')]);
    return { a, b, ca, cb, room: serverRoom(colyseus, created.roomId) };
  }

  const coinsOf = async (id: string) => (await User.findById(id))!.coins;

  it('COS-6 each player\'s striker and coin set are sent on join and seen by everyone', async () => {
    const { ca, cb } = await started1v1();
    await until(() => Object.keys((cb.room.state as { toJSON(): LobbyView }).toJSON().players).length === 2);
    const players = Object.values((cb.room.state as { toJSON(): LobbyView }).toJSON().players);
    const anik = players.find((p) => p.name === 'Anik')!;
    const bina = players.find((p) => p.name === 'Bina')!;
    expect([anik.striker, anik.coinSet]).toEqual(['gold-striker', 'jade-coins']);
    expect([bina.striker, bina.coinSet]).toEqual(['classic-striker', 'classic-coins']);
    expect(ca.room.sessionId).not.toBe(cb.room.sessionId);
  });

  it('COS-2 online rewards per result: winner 30, loser 10, each told their own', async () => {
    const { a, b, ca, cb, room } = await started1v1();
    const winner = seatOf(colyseus, ca) === 0 ? 'A' : 'B';
    (room as unknown as { onGameEnd(w: string): void }).onGameEnd(winner);
    await room.pendingRewards;
    expect([await coinsOf(a.id), await coinsOf(b.id)]).toEqual([ECONOMY.win, ECONOMY.loss]);
    expect((await ca.waitFor('reward')).coins).toBe(ECONOMY.win);
    expect((await cb.waitFor('reward')).coins).toBe(ECONOMY.loss);
  });

  it('COS-2 a player who left the game gets no reward', async () => {
    const { a, b, ca, cb, room } = await started1v1();
    await cb.room.leave();
    await until(() => [...room.state.players.values()].some((p) => p.left));
    (room as unknown as { onGameEnd(w: string): void }).onGameEnd(seatOf(colyseus, ca) === 0 ? 'A' : 'B');
    await room.pendingRewards;
    expect([await coinsOf(a.id), await coinsOf(b.id)]).toEqual([ECONOMY.win, 0]);
  });
});
