import { Client, type Room } from '@colyseus/sdk';
import {
  GAME_ROOM, MSG, parseServerMessage,
  type ClientMessage, type CreateRoomOptions, type LobbyView, type ServerMessage,
} from '@carrom/protocol';
import { API_BASE } from '@/constants/apiBase';
import { getToken } from './auth';

/** sessionStorage key: the reconnection token of the room this tab is in (survives a reload). */
export const RECONNECT_KEY = 'carrom.room';

type Listener<T> = (v: T) => void;

let room: Room | null = null;
/** Game messages since (and including) the last `game` message. Aim, emote and error are not kept. */
let log: ServerMessage[] = [];
const messageListeners = new Set<Listener<ServerMessage>>();
const lobbyListeners = new Set<Listener<LobbyView | null>>();

function sdk(): Client {
  const c = new Client(API_BASE);
  c.auth.token = getToken() ?? '';
  return c;
}

function session(op: 'get' | 'set' | 'del', value = ''): string | null {
  try {
    if (op === 'get') return sessionStorage.getItem(RECONNECT_KEY);
    if (op === 'set') sessionStorage.setItem(RECONNECT_KEY, value);
    else sessionStorage.removeItem(RECONNECT_KEY);
  } catch {
    // Storage blocked: a reload simply won't rejoin.
  }
  return null;
}

const emitLobby = (v: LobbyView | null) => lobbyListeners.forEach((l) => l(v));

function attach(r: Room): Room {
  room = r;
  log = [];
  session('set', r.reconnectionToken);
  r.onMessage(MSG, (raw: unknown) => {
    const m = parseServerMessage(raw);
    if (!m) return;
    if (m.type === 'game') log = [];
    if (m.type !== 'aim' && m.type !== 'emote' && m.type !== 'error') log.push(m);
    messageListeners.forEach((l) => l(m));
  });
  r.onStateChange((s: { toJSON(): unknown }) => emitLobby(s.toJSON() as LobbyView));
  r.onReconnect(() => session('set', r.reconnectionToken));
  r.onLeave(() => {
    if (room !== r) return;
    room = null;
    log = [];
    session('del');
    emitLobby(null);
  });
  return r;
}

/** ROOM-1: create a private room; the creator joins it. */
export async function createGameRoom(opts: CreateRoomOptions): Promise<Room> {
  return attach(await sdk().create(GAME_ROOM, opts));
}

export async function joinGameRoom(roomId: string): Promise<Room> {
  return attach(await sdk().joinById(roomId));
}

/** ROOM-8: after a page reload, get back into the room this tab was in. Null if there is none. */
export async function resumeGameRoom(): Promise<Room | null> {
  if (room) return room;
  const token = session('get');
  if (!token) return null;
  try {
    return attach(await sdk().reconnect(token));
  } catch {
    session('del');
    return null;
  }
}

/** Leave on purpose (the server gives the seat to the bot during a game). */
export async function leaveGameRoom(): Promise<void> {
  const r = room;
  room = null;
  log = [];
  session('del');
  emitLobby(null);
  await r?.leave().catch(() => {});
}

export function sendToRoom(msg: ClientMessage): void {
  room?.send(MSG, msg);
}

export const currentRoom = (): Room | null => room;
export const mySessionId = (): string | null => room?.sessionId ?? null;
export const gameLog = (): readonly ServerMessage[] => log;
export const currentLobby = (): LobbyView | null =>
  (room?.state as { toJSON?: () => unknown } | undefined)?.toJSON?.() as LobbyView | null ?? null;

export function onServerMessage(l: Listener<ServerMessage>): () => void {
  messageListeners.add(l);
  return () => messageListeners.delete(l);
}

export function onLobbyChange(l: Listener<LobbyView | null>): () => void {
  lobbyListeners.add(l);
  return () => lobbyListeners.delete(l);
}
