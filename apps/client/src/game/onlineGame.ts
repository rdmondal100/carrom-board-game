import { simulateShot, stateHash, type ShotInput } from '@carrom/engine';
import {
  CarromRoomConfigSchema, lobbyConfig, type AimHint, type CarromRoomConfig, type LobbyView, type PlayerView,
  type ServerMessage,
} from '@carrom/protocol';
import { applyShot, seatsFor, type GameState, type RuleEvent } from '@carrom/rules';
import type { LocalGame } from './localGame';

/** HUB-5 the room messages with carrom's payloads: move = shot, view = whole game, events = rule events. */
export type CarromMessage = ServerMessage<GameState, RuleEvent, ShotInput, AimHint>;
export type ShotResult = Extract<CarromMessage, { type: 'moveResult' }>;
export type Timeout = Extract<CarromMessage, { type: 'timeout' }>;

/** A carrom room's settings from its lobby (the server checked them; a broken value reads as 1v1 colour). */
export function carromConfigOf(lobby: Pick<LobbyView, 'config'>): CarromRoomConfig {
  const r = CarromRoomConfigSchema.safeParse(lobbyConfig(lobby));
  return r.success ? r.data : { format: '1v1', preset: 'colour', length: { kind: 'board' } };
}
export type Queued = ShotResult | Timeout;

/**
 * What an online game screen shows. The server is the authority: each
 * shotResult / timeout waits in `queue` and is shown in turnId order.
 */
export interface Online {
  /** Game state on screen (after the last shown result). */
  shown: GameState;
  /** turnId the next shot must carry, as shown. */
  turnId: number;
  queue: Queued[];
  /** turnId whose shot is animating on this screen (own shot or a replay). */
  animating: number | null;
  /** State of the `game` message this screen started from (a new one starts over). */
  origin: GameState;
}

/** Fold one server message in (this room plays carrom). A `game` message replaces everything. */
export function receive(o: Online | null, raw: ServerMessage): Online | null {
  const m = raw as CarromMessage;
  if (m.type === 'game') return { shown: m.view, turnId: m.turnId, queue: [], animating: null, origin: m.view };
  if (!o || (m.type !== 'moveResult' && m.type !== 'timeout')) return o;
  if (m.turnId < o.turnId || o.queue.some((q) => q.turnId === m.turnId)) return o;
  return { ...o, queue: [...o.queue, m].sort((a, b) => a.turnId - b.turnId) };
}

/** The screen state from the messages the room has seen so far (see `gameLog`). */
export function fromLog(log: readonly ServerMessage[]): Online | null {
  return log.reduce<Online | null>(receive, null);
}

/**
 * Bring `o` up to date with the room's log (which starts at the latest `game`
 * message). Folding is idempotent, so messages missed while not listening are
 * picked up; a newer `game` message starts over.
 */
export function catchUp(o: Online | null, log: readonly ServerMessage[]): Online | null {
  const first = log[0] as CarromMessage | undefined;
  if (!o || (first?.type === 'game' && first.view !== o.origin)) return fromLog(log);
  return log.reduce<Online | null>((x, m) => (m.type === 'game' ? x : receive(x, m)), o);
}

export type Step =
  | { kind: 'idle' }
  | { kind: 'replay'; msg: ShotResult }
  | { kind: 'finish'; msg: ShotResult }
  | { kind: 'timeout'; msg: Timeout };

/** What the screen should do next. Nothing happens while a shot plays. */
export function nextStep(o: Online, playing: boolean): Step {
  const head = o.queue[0];
  if (playing || !head || head.turnId !== o.turnId) return { kind: 'idle' };
  if (head.type === 'timeout') return { kind: 'timeout', msg: head };
  return o.animating === head.turnId ? { kind: 'finish', msg: head } : { kind: 'replay', msg: head };
}

/** A shot for `turnId` starts animating here. */
export function animate(o: Online, turnId: number): Online {
  return { ...o, animating: turnId };
}

/** Result `turnId` (the head) is shown: its state becomes the screen state. Repeating it is a no-op. */
export function advance(o: Online, turnId: number): Online {
  const head = o.queue[0];
  if (!head || head.turnId !== turnId) return o;
  return { ...o, shown: head.view, turnId: head.turnId + 1, queue: o.queue.slice(1), animating: null };
}

/** Error codes the server answers a refused shot with. */
export const SHOT_ERRORS: readonly string[] = ['NOT_YOUR_TURN', 'STALE_TURN', 'BAD_MOVE', 'GAME_OVER', 'NOT_PLAYING', 'BAD_MESSAGE'];

/** The server refused this screen's shot: drop it (the board goes back to `shown`). */
export function dropOwnShot(o: Online): Online {
  return o.queue.some((q) => q.turnId === o.animating) ? o : { ...o, animating: null };
}

/** ROOM-5: does a local simulateShot + applyShot from `shown` give the server's hash? */
export function hashMatches(shown: GameState, msg: ShotResult): boolean {
  try {
    const sim = simulateShot(shown.board, msg.move);
    return stateHash(applyShot(shown, sim.events, sim.final).state.board) === msg.hash;
  } catch {
    return false;
  }
}

/** May the player at `seat` shoot now? */
export function canShoot(o: Online, seat: number | null, playing: boolean): boolean {
  return seat !== null && !playing && o.animating === null && o.queue.length === 0
    && o.shown.winner === null && o.shown.turnSeat === seat;
}

export function playerAt(lobby: LobbyView, seat: number): PlayerView | undefined {
  return Object.values(lobby.players).find((p) => p.seat === seat);
}

export function seatOf(lobby: LobbyView | null, sessionId: string | null): number | null {
  if (!lobby || !sessionId) return null;
  return lobby.players[sessionId]?.seat ?? null;
}

/** The online game in the shape the HUD and end dialogs read (names in seat order). */
export function asLocalGame(state: GameState, lobby: LobbyView): LocalGame {
  const seats = seatsFor(state.config.format);
  return {
    state,
    names: seats.map((s) => playerAt(lobby, s)?.name ?? ''),
    clockOn: true,
    players: seats.map(() => 'human'),
    takeover: seats.filter((s) => playerAt(lobby, s)?.bot === true),
  };
}
