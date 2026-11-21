import type { ColyseusTestServer } from '@colyseus/testing';
import type { Room as SdkRoom } from '@colyseus/sdk';
import type { ShotInput } from '@carrom/engine';
import type { CarromMatch } from '@carrom/game';
import { MSG, type AimHint, type CarromRoomConfig, type ClientMessage, type ServerMessage as AnyServerMessage } from '@carrom/protocol';
import type { GameState, RuleEvent } from '@carrom/rules';
import { User } from '../models/user.model.js';
import { signToken } from '../utils/jwt.js';
import type { GameRoom } from './game.room.js';
import type { RoomTiming } from './roomTiming.js';

export const SECRET = 'r'.repeat(32);

/** Room messages with carrom's payloads typed (the room tests play carrom). */
export type ServerMessage = AnyServerMessage<GameState, RuleEvent, ShotInput, AimHint>;

/** HUB-5 create options for a carrom room. */
export const carromRoom = (config: Partial<CarromRoomConfig> = {}) => ({
  gameId: 'carrom',
  config: { format: '1v1', preset: 'colour', length: { kind: 'board' }, ...config },
});

/** The running carrom game of a server room. */
export const carromMatchOf = (room: GameRoom): CarromMatch => room.match as CarromMatch;

/** Short waits so room tests run in seconds. Tests may change fields per case. */
export const fastTiming = (): RoomTiming => ({
  shotClockMs: 60_000, graceMs: 20, reconnectS: 60,
  botMinMs: 5, botMaxMs: 10, aimGapMs: 100, emoteGapMs: 2000, replayScale: 1,
});

/** A guest user in the DB and its token. */
export async function makeUser(name: string): Promise<string> {
  const user = await User.create({ name, isGuest: true });
  return signToken(user.id as string, SECRET);
}

export interface TestClient {
  room: SdkRoom;
  inbox: ServerMessage[];
  send(msg: ClientMessage | Record<string, unknown>): void;
  /** First message (already received or still to come) that matches. */
  waitFor<T extends ServerMessage['type']>(
    type: T, pred?: (m: Extract<ServerMessage, { type: T }>) => boolean, timeoutMs?: number,
  ): Promise<Extract<ServerMessage, { type: T }>>;
}

/** Join `roomId` with `token` (none = no token); auto-reconnection off. */
export async function join(colyseus: ColyseusTestServer, roomId: string, token?: string): Promise<TestClient> {
  colyseus.sdk.auth.token = token ?? '';
  const room = await colyseus.sdk.joinById(roomId);
  room.reconnection.enabled = false;
  return wrap(room);
}

export function wrap(room: SdkRoom): TestClient {
  const inbox: ServerMessage[] = [];
  const waiters: (() => void)[] = [];
  room.onMessage(MSG, (m: ServerMessage) => {
    inbox.push(m);
    waiters.splice(0).forEach((w) => w());
  });
  const client: TestClient = {
    room,
    inbox,
    send: (msg) => room.send(MSG, msg),
    waitFor: (type, pred = () => true, timeoutMs = 10_000) => new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`timed out waiting for ${type}`)), timeoutMs);
      const check = () => {
        const hit = inbox.find((m) => m.type === type && pred(m as never));
        if (hit) {
          clearTimeout(timer);
          resolve(hit as never);
        } else waiters.push(check);
      };
      check();
    }),
  };
  return client;
}

/** The server room behind a client. */
export function serverRoom(colyseus: ColyseusTestServer, roomId: string): GameRoom {
  return colyseus.getRoomById(roomId) as unknown as GameRoom;
}

/** Seat of a client's player, read on the server. */
export function seatOf(colyseus: ColyseusTestServer, c: TestClient): number {
  return serverRoom(colyseus, c.room.roomId).state.players.get(c.room.sessionId)?.seat ?? -1;
}

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Poll until `fn` is true. */
export async function until(fn: () => boolean, timeoutMs = 10_000): Promise<void> {
  const end = Date.now() + timeoutMs;
  while (!fn()) {
    if (Date.now() > end) throw new Error('condition not met in time');
    await sleep(10);
  }
}
