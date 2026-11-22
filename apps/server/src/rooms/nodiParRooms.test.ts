import { boot, type ColyseusTestServer } from '@colyseus/testing';
import type { Room as SdkRoom } from '@colyseus/sdk';
import { GAME_ROOM, MSG, type ServerMessage as AnyMessage } from '@carrom/protocol';
import {
  nodiBot, nodiParModule, type NodiConfig, type NodiEvent, type NodiMove, type NodiView,
} from '@hub/nodipar';
import { afterAll, afterEach, beforeAll, describe, expect, inject, it } from 'vitest';
import { createServer } from '../app.js';
import { connectDb, disconnectDb } from '../connectDb.js';
import { Match } from '../models/match.model.js';
import { User } from '../models/user.model.js';
import { signToken } from '../utils/jwt.js';
import { fastTiming, SECRET, seatOf, serverRoom, sleep, until, wrap, type TestClient } from './roomTestkit.js';

type NodiMessage = AnyMessage<NodiView, NodiEvent, NodiMove>;
const CONFIG: NodiConfig = { players: 2, borsha: true };
const inboxOf = (c: TestClient): NodiMessage[] => c.inbox as unknown as NodiMessage[];

function nextTurn(m: NodiMessage): { view: NodiView; turnId: number } | null {
  if (m.type === 'game') return { view: m.view, turnId: m.turnId };
  if (m.type === 'moveResult' || m.type === 'timeout') return { view: m.view, turnId: m.turnId + 1 };
  return null;
}

/** The client plays its own seat with the medium bot, from the view it was sent. */
function autoPlay(c: TestClient, seat: number): void {
  let seed = seat * 1000;
  c.room.onMessage(MSG, (raw: unknown) => {
    const n = nextTurn(raw as NodiMessage);
    if (!n || n.view.winner !== null || n.view.turnSeat !== seat) return;
    c.send({ type: 'move', turnId: n.turnId, move: nodiBot(n.view, seat, 'medium', seed++) });
  });
}

describe('nodi par through the shared rooms (NODI-5)', () => {
  let colyseus: ColyseusTestServer;
  const open: SdkRoom[] = [];

  beforeAll(async () => {
    await connectDb(inject('mongoUri'));
    const { gameServer } = createServer(
      { CORS_ORIGIN: [], NODE_ENV: 'test', JWT_SECRET: SECRET, GOOGLE_CLIENT_IDS: [] },
      { roomTiming: { ...fastTiming(), replayScale: 0 } },
    );
    colyseus = await boot(gameServer);
  });
  afterEach(async () => {
    await Promise.all(open.splice(0).map((r) => r.leave().catch(() => {})));
    await sleep(150);
    await colyseus.cleanup();
    await Promise.all([User.deleteMany({}), Match.deleteMany({})]);
  });
  afterAll(async () => {
    await colyseus.shutdown();
    await disconnectDb();
  });

  async function joinAs(roomId: string, name: string): Promise<TestClient> {
    const u = await User.create({ name, isGuest: true });
    colyseus.sdk.auth.token = signToken(u.id as string, SECRET);
    const r = await colyseus.sdk.joinById(roomId);
    r.reconnection.enabled = false;
    open.push(r);
    return wrap(r);
  }

  it('NODI-5 scripted online 1v1 game (invite room, Borsha) to the end; replays match the server; both get coins', async () => {
    const room = await colyseus.createRoom(GAME_ROOM, { gameId: 'nodipar', config: CONFIG });
    const host = await joinAs(room.roomId, 'Anik');
    const guest = await joinAs(room.roomId, 'Bina');
    expect([seatOf(colyseus, host), seatOf(colyseus, guest)]).toEqual([0, 2]);
    const server = serverRoom(colyseus, room.roomId);

    autoPlay(host, 0);
    autoPlay(guest, 2);
    host.send({ type: 'start' });
    const isEnd = (m: { view: unknown }) => (m.view as NodiView).winner !== null;
    await Promise.all([host, guest].map((c) => c.waitFor('moveResult', isEnd, 90_000)));

    const moves = inboxOf(host).filter((m) => m.type === 'moveResult');
    const last = moves.at(-1)!;
    expect(last.type === 'moveResult' && last.view.winner).toMatch(/^[AB]$/);
    expect(moves.length).toBeGreaterThanOrEqual(2 * 2 * 9);
    // NODI-5 a client replaying each move from the previous view lands on the server's hash.
    const first = inboxOf(host).find((m) => m.type === 'game');
    let prev = first?.type === 'game' ? first.view : null;
    for (const m of moves) {
      if (m.type !== 'moveResult' || !prev) continue;
      const out = nodiParModule.applyMove(prev, m.seat, prev.turnId, m.move);
      if (!out.ok) throw new Error(out.message);
      expect(nodiParModule.hash(out.state)).toBe(m.hash);
      prev = m.view;
    }
    expect(host.inbox.concat(guest.inbox).some((m) => m.type === 'error')).toBe(false);
    await until(() => server.state.phase === 'ended');
    await host.waitFor('reward', () => true);
    await guest.waitFor('reward', () => true);
  }, 100_000);
});
