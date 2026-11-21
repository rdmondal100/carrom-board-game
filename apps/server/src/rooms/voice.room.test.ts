import { boot, type ColyseusTestServer } from '@colyseus/testing';
import { RANKED_ROOM, type VoiceSignal } from '@carrom/protocol';
import { afterAll, afterEach, beforeAll, describe, expect, inject, it } from 'vitest';
import { createServer } from '../app.js';
import { connectDb, disconnectDb } from '../connectDb.js';
import { Match } from '../models/match.model.js';
import { User } from '../models/user.model.js';
import { signToken } from '../utils/jwt.js';
import { rankedCreateOptions } from './ranked.js';
import { carromRoom, fastTiming, join, makeUser, SECRET, serverRoom, sleep, until, type TestClient } from './roomTestkit.js';

const sdp = (text: string): VoiceSignal => ({ kind: 'offer', sdp: text });
const voiceIn = (c: TestClient) => c.inbox.filter((m) => m.type === 'voice');

describe('voice in rooms', () => {
  let colyseus: ColyseusTestServer;
  const clients: TestClient[] = [];

  beforeAll(async () => {
    await connectDb(inject('mongoUri'));
    const { gameServer } = createServer(
      { CORS_ORIGIN: [], NODE_ENV: 'test', JWT_SECRET: SECRET, GOOGLE_CLIENT_IDS: [] },
      { roomTiming: fastTiming() },
    );
    colyseus = await boot(gameServer);
  });
  afterEach(async () => {
    await Promise.all(clients.splice(0).map((c) => c.room.leave().catch(() => {})));
    // A ranked room left mid-game writes an abandon Match; let it land, then wipe it with the users.
    await sleep(150);
    await colyseus.cleanup();
    await Promise.all([User.deleteMany({}), Match.deleteMany({})]);
  });
  afterAll(async () => {
    await colyseus.shutdown();
    await disconnectDb();
  });

  async function joinAs(roomId: string, token: string): Promise<TestClient> {
    const c = await join(colyseus, roomId, token);
    clients.push(c);
    return c;
  }

  const voiceOn = (c: TestClient) => c.send({ type: 'voiceState', on: true, muted: true });
  const onAt = (roomId: string, c: TestClient) => () => serverRoom(colyseus, roomId).state.players.get(c.room.sessionId)?.voiceOn === true;

  it('VOICE-2 room relays voice only to the addressed session; a forged to for another room is dropped', async () => {
    const room = await colyseus.createRoom('game', carromRoom({ format: '2v2' }));
    const [a, b, c] = [
      await joinAs(room.roomId, await makeUser('Ana')),
      await joinAs(room.roomId, await makeUser('Bob')),
      await joinAs(room.roomId, await makeUser('Cai')),
    ];
    const other = await colyseus.createRoom('game', carromRoom());
    const x = await joinAs(other.roomId, await makeUser('Xen'));
    for (const p of [a, b, c, x]) voiceOn(p);
    await until(() => [a, b, c].every((p) => onAt(room.roomId, p)()) && onAt(other.roomId, x)());

    // Synced voice state, seen by everyone.
    await until(() => b.room.state.players.get(a.room.sessionId)?.voiceOn === true);

    a.send({ type: 'voice', to: x.room.sessionId, signal: sdp('forged') });
    a.send({ type: 'voice', to: a.room.sessionId, signal: sdp('self') });
    a.send({ type: 'voice', to: b.room.sessionId, signal: sdp('for-b') });
    const got = await b.waitFor('voice');
    expect(got).toEqual({ type: 'voice', from: a.room.sessionId, signal: sdp('for-b') });

    // c and x got nothing; a didn't get its own message back.
    c.send({ type: 'voice', to: a.room.sessionId, signal: sdp('c-to-a') });
    await a.waitFor('voice');
    expect(voiceIn(a).map((m) => m.type === 'voice' && m.from)).toEqual([c.room.sessionId]);
    expect(voiceIn(c)).toEqual([]);
    expect(voiceIn(x)).toEqual([]);
    expect(voiceIn(b)).toHaveLength(1);
  });

  it('VOICE-2 a player with voice off gets no signalling; voice never ends a bot takeover', async () => {
    const room = await colyseus.createRoom('game', carromRoom());
    const a = await joinAs(room.roomId, await makeUser('Ana'));
    const b = await joinAs(room.roomId, await makeUser('Bob'));
    voiceOn(a);
    await until(onAt(room.roomId, a));
    a.send({ type: 'voice', to: b.room.sessionId, signal: sdp('b-is-off') });
    voiceOn(b);
    await until(onAt(room.roomId, b));
    a.send({ type: 'voice', to: b.room.sessionId, signal: sdp('b-is-on') });
    const got = await b.waitFor('voice');
    expect(got.type === 'voice' && got.signal).toEqual(sdp('b-is-on'));
    expect(voiceIn(b)).toHaveLength(1);

    const srv = serverRoom(colyseus, room.roomId);
    const pa = srv.state.players.get(a.room.sessionId)!;
    pa.bot = true;
    a.send({ type: 'voiceState', on: true, muted: false });
    await until(() => pa.voiceMuted === false);
    expect(pa.bot).toBe(true);
  });

  it('VOICE-4 ranked room: voice stays off until both players opt in', async () => {
    const [ua, ub] = await Promise.all([User.create({ name: 'Ana' }), User.create({ name: 'Bob' })]);
    const room = await colyseus.createRoom(RANKED_ROOM, rankedCreateOptions('carrom', ua.id as string, ub.id as string));
    const a = await joinAs(room.roomId, signToken(ua.id as string, SECRET));
    const b = await joinAs(room.roomId, signToken(ub.id as string, SECRET));
    await a.waitFor('game');
    expect(serverRoom(colyseus, room.roomId).state.players.get(a.room.sessionId)?.voiceOn).toBe(false);

    voiceOn(a);
    await until(onAt(room.roomId, a));
    a.send({ type: 'voice', to: b.room.sessionId, signal: sdp('too-early') });
    b.send({ type: 'voice', to: a.room.sessionId, signal: sdp('too-early-b') });

    voiceOn(b);
    await until(onAt(room.roomId, b));
    a.send({ type: 'voice', to: b.room.sessionId, signal: sdp('both-in') });
    const got = await b.waitFor('voice');
    expect(got.type === 'voice' && got.signal).toEqual(sdp('both-in'));
    expect(voiceIn(b)).toHaveLength(1);
    expect(voiceIn(a)).toEqual([]);

    // Turning it off again closes it for both.
    b.send({ type: 'voiceState', on: false, muted: true });
    await until(() => !onAt(room.roomId, b)());
    a.send({ type: 'voice', to: b.room.sessionId, signal: sdp('after-off') });
    a.send({ type: 'emote', id: 'gg' });
    await b.waitFor('emote');
    expect(voiceIn(b)).toHaveLength(1);
  });
});
