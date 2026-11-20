import type { z } from 'zod';

/** HUB-1 every game the hub knows about (registered or not yet). */
export const GAME_IDS = ['carrom', 'ludo', 'callbreak', 'nodipar'] as const;
export type GameId = (typeof GAME_IDS)[number];

/** HUB-1 why a move was refused. Nothing changes when a move is refused. */
export type MoveError = 'GAME_OVER' | 'NOT_YOUR_TURN' | 'STALE_TURN' | 'BAD_MOVE';

export interface MoveOk<S, E> {
  ok: true;
  state: S;
  events: E[];
  /** How long the client animates the move; the server's clock waits this long. */
  durationMs: number;
}
export interface MoveRefused { ok: false; code: MoveError; message: string }
export type MoveOutcome<S, E> = MoveOk<S, E> | MoveRefused;

/** A finished game. `winner` is a team id (team games) or a seat as a string. */
export interface GameResult {
  winner: string;
  /** 1 = first place, per seat in `seats(config)` order. */
  placings: number[];
}

/**
 * HUB-1: one game, as pure deterministic functions. The server is the only
 * place that runs `newGame` / `applyMove` / `timeout` for real; randomness
 * (dice, deals, first player) comes from the seed held in the state (HUB-2).
 *
 * C config, S state (includes the turn id), M move, E event, V what one seat
 * sees, H an optional live hint (e.g. carrom's aim preview).
 */
export interface GameModule<C = unknown, S = unknown, M = unknown, E = unknown, V = unknown, H = unknown> {
  id: string;
  /** Some players must not see parts of the state (card hands): views are sent per seat. */
  hasHiddenInfo: boolean;
  configSchema: z.ZodType<C>;
  moveSchema: z.ZodType<M>;
  /** Live, non-binding data a player sends while thinking, relayed to the others. */
  hintSchema?: z.ZodType<H>;
  /** The seats a game with this config uses, in join order. */
  seats(config: C): readonly number[];
  /** Team of a seat (free-for-all games: the seat itself, as a string). */
  teamOf(config: C, seat: number): string;
  configOf(state: S): C;
  newGame(config: C, seed: number): S;
  /** ROOM-9: same settings, a fresh game (the game decides who starts). */
  rematch(state: S): S;
  applyMove(state: S, seat: number, turnId: number, move: M): MoveOutcome<S, E>;
  /** The clock ran out for the seat to move. */
  timeout(state: S): { state: S; seat: number; events: E[] };
  /** Seats the server bot should take over after these events (RUL-10 style). */
  takeovers(events: readonly E[]): number[];
  turnSeat(state: S): number;
  /** Id the next move must carry. */
  turnId(state: S): number;
  result(state: S): GameResult | null;
  /** What `seat` may see (null = a spectator). Without hidden info this is the whole game. */
  view(state: S, seat: number | null): V;
  hash(state: S): string;
  /** Rounds played so far (boards, deals), for match records. */
  rounds(state: S): number;
  bot(state: S, seat: number, level: BotLevel, seed: number): M;
}

export type BotLevel = 'easy' | 'medium' | 'hard';

/** A module whose type parameters don't matter to the caller (rooms, registry). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyGameModule = GameModule<any, any, any, any, any, any>;

export const refuse = (code: MoveError, message: string): MoveRefused => ({ ok: false, code, message });
