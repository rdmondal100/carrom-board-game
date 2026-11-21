import { boot, type ColyseusTestServer } from '@colyseus/testing';
import type { Room as SdkRoom } from '@colyseus/sdk';
import { GAME_ROOM, MSG, type ServerMessage as AnyMessage } from '@carrom/protocol';
import { callbreakBot, type CallbreakConfig, type CallbreakEvent, type CallbreakMove, type CallbreakView } from '@hub/callbreak';
import { afterAll, afterEach, beforeAll, describe, expect, inject, it } from 'vitest';
import { createServer } from '../app.js';
import { connectDb, disconnectDb } from '../connectDb.js';
import { Match } from '../models/match.model.js';
import { User } from '../models/user.model.js';
import { signToken } from '../utils/jwt.js';
import { fastTiming, SECRET, seatOf, serverRoom, sleep, until, wrap, type TestClient } from './roomTestkit.js';

type CbMessage = AnyMessage<CallbreakView, CallbreakEvent, CallbreakMove>;
const CONFIG: CallbreakConfig = { rounds: 3, redeal: true };
/** A card written as JSON: "AS", "TH", … */
const CARD = /"([2-9TJQKA][SHDC])"/g;
/** A client's inbox with Callbreak's payloads typed. */
const inboxOf = (c: TestClient): CbMessage[] => c.inbox as unknown as CbMessage[];
const firstHand = (c: TestClient): string[] => {
  const m = inboxOf(c).find((x) => x.type === 'game');
  return m?.type === 'game' ? m.view.hand : [];
};

function nextTurn(m: CbMessage): { view: CallbreakView; turnId: number } | null {
  if (m.type === 'game') return { view: m.view, turnId: m.turnId };
  if (m.type === 'moveResult' || m.type === 'timeout') return { view: m.view, turnId: m.turnId + 1 };
  return null;
}

/** The client plays its own seat with the hard bot, from the view it was sent. */
function autoPlay(c: TestClient, seat: number): void {
  let seed = seat * 1000;
  c.room.onMessage(MSG, (raw: unknown) => {
    const n = nextTurn(raw as CbMessage);
    if (!n || n.view.winner !== null || n.view.turnSeat !== seat) return;
    c.send({ type: 'move', turnId: n.turnId, move: callbreakBot(n.view, 'hard', seed++) });
  });
}

/**
 * CB-5 every card named in a message must be public in that message (played to a
 * trick, now or before) or in the receiver's own hand. Another seat's card can only
 * show up once it has been played.
 */
function leakedCards(m: CbMessage): string[] {
  const allowed = new Set<string>();
  const view = 'view' in m ? (m.view as CallbreakView) : null;
  const events: CallbreakEvent[] = [...('events' in m ? (m.events as CallbreakEvent[]) : []), ...(view?.recent ?? [])];
  for (const c of view?.hand ?? []) allowed.add(c);
  for (const p of [...(view?.trick ?? []), ...(view?.tricks.flat() ?? [])]) allowed.add(p.card);
  for (const e of events) if (e.type === 'play') allowed.add(e.card);
  if (m.type === 'moveResult' && 'card' in m.move) allowed.add(m.move.card);
  return [...JSON.stringify(m).matchAll(CARD)].map((x) => x[1]!).filter((c) => !allowed.has(c));
}

describe('callbreak through the shared rooms (CB-5, CB-8)', () => {
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

  it('CB-5 no message to seat 0 ever contains seat 1-3\'s hand (a full scripted online game, two bot seats)', async () => {
    const room = await colyseus.createRoom(GAME_ROOM, { gameId: 'callbreak', config: CONFIG });
    const host = await joinAs(room.roomId, 'Anik');
    const guest = await joinAs(room.roomId, 'Bina');
    expect([seatOf(colyseus, host), seatOf(colyseus, guest)]).toEqual([0, 1]);
    const server = serverRoom(colyseus, room.roomId);

    // CB-8 only the host fills seats; a bot can be taken out again.
    guest.send({ type: 'seatBot', seat: 2, on: true });
    await guest.waitFor('error', (m) => m.code === 'NOT_ALLOWED');
    host.send({ type: 'seatBot', seat: 1, on: true });
    await host.waitFor('error', (m) => m.code === 'NOT_ALLOWED');
    for (const seat of [2, 3]) host.send({ type: 'seatBot', seat, on: true });
    host.send({ type: 'seatBot', seat: 3, on: false });
    host.send({ type: 'seatBot', seat: 3, on: true });
    await until(() => server.state.players.size === 4);
    const bots = [...server.state.players.values()].filter((p) => p.bot);
    expect(bots.map((p) => p.seat).sort()).toEqual([2, 3]);

    autoPlay(host, 0);
    autoPlay(guest, 1);
    host.send({ type: 'start' });
    const isEnd = (m: { view: unknown }) => (m.view as CallbreakView).winner !== null;
    await Promise.all([host, guest].map((c) => c.waitFor('moveResult', isEnd, 60_000)));

    const views = inboxOf(host).filter((m) => 'view' in m);
    const moves = host.inbox.filter((m) => m.type === 'moveResult');
    expect(moves.length).toBe(CONFIG.rounds * 4 * (1 + 13));
    expect(moves.some((m) => m.seat === 2) && moves.some((m) => m.seat === 3)).toBe(true);
    for (const m of inboxOf(host)) expect(leakedCards(m), m.type).toEqual([]);
    for (const m of views) {
      const v = (m as { view: CallbreakView }).view;
      expect(v.seat).toBe(0);
      expect(Object.keys(v)).not.toContain('hands');
    }
    for (const m of moves) expect(m.hash).toBe('');
    // The guest saw its own hand, never the host's.
    const guestHand = firstHand(guest);
    expect(guestHand).toHaveLength(13);
    expect(firstHand(host).some((c) => guestHand.includes(c))).toBe(false);
    expect(host.inbox.concat(guest.inbox).some((m) => m.type === 'error' && m.code !== 'NOT_ALLOWED')).toBe(false);
    await until(() => server.state.phase === 'ended');
  }, 70_000);

  it('CB-8 one person and three bots play to the end; a game against bots alone gives no online coins', async () => {
    const room = await colyseus.createRoom(GAME_ROOM, { gameId: 'callbreak', config: CONFIG });
    const me = await joinAs(room.roomId, 'Anik');
    for (const seat of [1, 2, 3]) me.send({ type: 'seatBot', seat, on: true });
    const server = serverRoom(colyseus, room.roomId);
    await until(() => server.state.players.size === 4);
    autoPlay(me, 0);
    me.send({ type: 'start' });
    await me.waitFor('moveResult', (m) => (m.view as unknown as CallbreakView).winner !== null, 60_000);
    await until(() => server.state.phase === 'ended');
    await sleep(100);
    expect(server.pendingRewards).toBeNull();
    expect(me.inbox.some((m) => m.type === 'reward')).toBe(false);
  }, 70_000);
});
