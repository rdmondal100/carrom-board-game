import { lobbyConfig, type LobbyView, type PlayerView, type ServerMessage } from '@carrom/protocol';
import {
  CallbreakConfigSchema, DEFAULT_CALLBREAK_CONFIG, type CallbreakConfig, type CallbreakEvent, type CallbreakMove, type CallbreakView,
} from '@hub/callbreak';

/** HUB-5 the room messages with Callbreak's payloads (each view is this client's own seat's). */
export type CbMessage = ServerMessage<CallbreakView, CallbreakEvent, CallbreakMove>;
export type Change = Extract<CbMessage, { type: 'moveResult' | 'timeout' }>;

export function cbConfigOf(lobby: Pick<LobbyView, 'config'>): CallbreakConfig {
  const r = CallbreakConfigSchema.safeParse(lobbyConfig(lobby));
  return r.success ? r.data : DEFAULT_CALLBREAK_CONFIG;
}

/** CB-8 what an online Callbreak screen shows; server changes wait in `queue` and play in turnId order. */
export interface CbOnline {
  shown: CallbreakView;
  turnId: number;
  queue: Change[];
  /** The `game` view this screen started from (a new one starts over). */
  origin: CallbreakView;
  /** A move this screen sent and the server hasn't answered yet. */
  sent: number | null;
}

export function receive(o: CbOnline | null, raw: ServerMessage): CbOnline | null {
  const m = raw as CbMessage;
  if (m.type === 'game') return { shown: m.view, turnId: m.turnId, queue: [], origin: m.view, sent: null };
  if (!o || (m.type !== 'moveResult' && m.type !== 'timeout')) return o;
  if (m.turnId < o.turnId || o.queue.some((q) => q.turnId === m.turnId)) return o;
  return { ...o, queue: [...o.queue, m].sort((a, b) => a.turnId - b.turnId) };
}

/** Bring `o` up to date with the room's log (starting at the latest `game`). Idempotent. */
export function catchUp(o: CbOnline | null, log: readonly ServerMessage[]): CbOnline | null {
  const first = log[0] as CbMessage | undefined;
  if (!o || (first?.type === 'game' && first.view !== o.origin)) return log.reduce<CbOnline | null>(receive, null);
  return log.reduce<CbOnline | null>((x, m) => (m.type === 'game' ? x : receive(x, m)), o);
}

export const nextChange = (o: CbOnline): Change | null => {
  const head = o.queue[0];
  return head && head.turnId === o.turnId ? head : null;
};

export function advance(o: CbOnline, turnId: number): CbOnline {
  const head = o.queue[0];
  if (!head || head.turnId !== turnId) return o;
  return { ...o, shown: head.view, turnId: turnId + 1, queue: o.queue.slice(1), sent: null };
}

export function canAct(o: CbOnline, seat: number | null, busy: boolean): boolean {
  return seat !== null && !busy && o.sent === null && o.queue.length === 0 && o.shown.winner === null && o.shown.turnSeat === seat;
}

export function playerAt(lobby: LobbyView, seat: number): PlayerView | undefined {
  return Object.values(lobby.players).find((p) => p.seat === seat);
}

export function seatOf(lobby: LobbyView | null, sessionId: string | null): number | null {
  if (!lobby || !sessionId) return null;
  return lobby.players[sessionId]?.seat ?? null;
}

/** CB-8 a seat the host gave to a bot (no person behind it). */
export const isBotSeat = (p: PlayerView | undefined): boolean => p !== undefined && p.bot && p.userId === '';

/** Names per seat 0..3; bot seats get `botName(seat)`. */
export const namesOf = (lobby: LobbyView, botName: (seat: number) => string): string[] =>
  [0, 1, 2, 3].map((s) => {
    const p = playerAt(lobby, s);
    return p && !isBotSeat(p) ? p.name : botName(s);
  });
