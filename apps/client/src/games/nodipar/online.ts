import { lobbyConfig, type LobbyView, type PlayerView, type ServerMessage } from '@carrom/protocol';
import { DEFAULT_NODI_CONFIG, NodiConfigSchema, type NodiConfig, type NodiEvent, type NodiMove, type NodiView } from '@hub/nodipar';

/** HUB-5 the room messages with Nodi Par's payloads. */
export type NodiMessage = ServerMessage<NodiView, NodiEvent, NodiMove>;
export type Change = Extract<NodiMessage, { type: 'moveResult' | 'timeout' }>;

/** A Nodi Par room's settings from its lobby (a broken value reads as the defaults). */
export function nodiConfigOf(lobby: Pick<LobbyView, 'config'>): NodiConfig {
  const r = NodiConfigSchema.safeParse(lobbyConfig(lobby));
  return r.success ? r.data : DEFAULT_NODI_CONFIG;
}

/**
 * NODI-5 what an online Nodi Par screen shows. The server is the authority: each
 * moveResult / timeout waits in `queue` and is played in turnId order.
 */
export interface NodiOnline {
  shown: NodiView;
  /** turnId the next move must carry, as shown. */
  turnId: number;
  queue: Change[];
  /** The `game` view this screen started from (a new one starts over). */
  origin: NodiView;
  /** A move this screen sent and the server hasn't answered yet. */
  sent: number | null;
}

/** Fold one server message in. A `game` message replaces everything. */
export function receive(o: NodiOnline | null, raw: ServerMessage): NodiOnline | null {
  const m = raw as NodiMessage;
  if (m.type === 'game') return { shown: m.view, turnId: m.turnId, queue: [], origin: m.view, sent: null };
  if (!o || (m.type !== 'moveResult' && m.type !== 'timeout')) return o;
  if (m.turnId < o.turnId || o.queue.some((q) => q.turnId === m.turnId)) return o;
  return { ...o, queue: [...o.queue, m].sort((a, b) => a.turnId - b.turnId) };
}

/** Bring `o` up to date with the room's log (starting at the latest `game`). Idempotent. */
export function catchUp(o: NodiOnline | null, log: readonly ServerMessage[]): NodiOnline | null {
  const first = log[0] as NodiMessage | undefined;
  if (!o || (first?.type === 'game' && first.view !== o.origin)) return log.reduce<NodiOnline | null>(receive, null);
  return log.reduce<NodiOnline | null>((x, m) => (m.type === 'game' ? x : receive(x, m)), o);
}

/** The next change to play, if it is the one the screen waits for. */
export const nextChange = (o: NodiOnline): Change | null => {
  const head = o.queue[0];
  return head && head.turnId === o.turnId ? head : null;
};

/** The head change has been played: its view is now on screen. */
export function advance(o: NodiOnline, turnId: number): NodiOnline {
  const head = o.queue[0];
  if (!head || head.turnId !== turnId) return o;
  return { ...o, shown: head.view, turnId: turnId + 1, queue: o.queue.slice(1), sent: null };
}

/** May the player at `seat` act now (nothing waiting, their turn, game on)? */
export function canAct(o: NodiOnline, seat: number | null, busy: boolean): boolean {
  return seat !== null && !busy && o.sent === null && o.queue.length === 0 && o.shown.winner === null && o.shown.turnSeat === seat;
}

export function playerAt(lobby: LobbyView, seat: number): PlayerView | undefined {
  return Object.values(lobby.players).find((p) => p.seat === seat);
}

export function seatOf(lobby: LobbyView | null, sessionId: string | null): number | null {
  if (!lobby || !sessionId) return null;
  return lobby.players[sessionId]?.seat ?? null;
}

/** Names per seat 0..3 from the lobby. */
export const namesOf = (lobby: LobbyView): string[] => [0, 1, 2, 3].map((s) => playerAt(lobby, s)?.name ?? '');
