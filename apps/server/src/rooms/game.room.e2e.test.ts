import { boot, type ColyseusTestServer } from '@colyseus/testing';
import { chooseShot } from '@carrom/bot';
import type { ServerMessage } from '@carrom/protocol';
import type { GameState } from '@carrom/rules';
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest';
import { createServer } from '../app.js';
import { connectDb, disconnectDb } from '../connectDb.js';
import { User } from '../models/user.model.js';
import { fastTiming, join, makeUser, SECRET, seatOf, type TestClient } from './roomTestkit.js';

/** After this message, whose turn is it and what turnId must their shot carry? */
function nextTurn(m: ServerMessage): { state: GameState; turnId: number } | null {
  if (m.type === 'game') return { state: m.state, turnId: m.turnId };
  if (m.type === 'shotResult' || m.type === 'timeout') return { state: m.state, turnId: m.turnId + 1 };
  return null;
}

describe('game room, full game', () => {
  let colyseus: ColyseusTestServer;

  beforeAll(async () => {
    await connectDb(inject('mongoUri'));
    const { gameServer } = createServer(
      { CORS_ORIGIN: [], NODE_ENV: 'test', JWT_SECRET: SECRET, GOOGLE_CLIENT_IDS: [] },
      { roomTiming: fastTiming() },
    );
    colyseus = await boot(gameServer);
  });
  afterAll(async () => {
    await colyseus.shutdown();
    await User.deleteMany({});
    await disconnectDb();
  });

  it('ROOM-3 a scripted 2v2 room game runs to gameEnd with 4 test clients', async () => {
    const room = await colyseus.createRoom('game', { format: '2v2', preset: 'colour', length: { kind: 'board' } });
    const players: TestClient[] = [];
    for (const name of ['Anik', 'Bina', 'Chayan', 'Dola']) players.push(await join(colyseus, room.roomId, await makeUser(name)));
    const seats = players.map((c) => seatOf(colyseus, c));
    expect([...seats].sort()).toEqual([0, 1, 2, 3]);

    // Each client plays its own seat with the medium bot whenever the turn comes to it.
    let seed = 1;
    players.forEach((c, i) => {
      c.room.onMessage('msg', (m: ServerMessage) => {
        const next = nextTurn(m);
        if (!next || next.state.winner !== null || next.state.turnSeat !== seats[i]) return;
        c.send({ type: 'shot', turnId: next.turnId, input: chooseShot(next.state, 'medium', seed++) });
      });
    });
    players[0]!.send({ type: 'start' });

    const shots = (c: TestClient) => c.inbox.filter((m) => m.type === 'shotResult');
    const isEnd = (m: Extract<ServerMessage, { type: 'shotResult' }>) => m.ruleEvents.some((e) => e.type === 'gameEnd');
    const [end] = await Promise.all(players.map((c) => c.waitFor('shotResult', isEnd, 170_000)));
    expect(end!.state.winner).not.toBeNull();
    // Every client saw the same shots, in order, with no errors and no timeouts.
    const ids = shots(players[0]!).map((m) => m.turnId);
    expect(ids).toEqual(ids.map((_, i) => i));
    for (const c of players) {
      expect(shots(c).map((m) => m.stateHash)).toEqual(shots(players[0]!).map((m) => m.stateHash));
      expect(c.inbox.some((m) => m.type === 'error' || m.type === 'timeout')).toBe(false);
    }
    await Promise.all(players.map((c) => c.room.leave()));
  }, 180_000);
});
