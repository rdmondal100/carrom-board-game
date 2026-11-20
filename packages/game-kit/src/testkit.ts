// Toy games that exercise the GameModule contract in tests (game-kit, server
// rooms and queues). Not shipped to players.
import { z } from 'zod';
import { refuse, type GameModule } from './module';
import { nextInt, type Rng } from './rng';

export interface ToyConfig {
  /** Each seat holds a secret number; with `hidden`, a seat only sees its own. */
  hidden: boolean;
}

export interface ToyState {
  config: ToyConfig;
  seed: number;
  rng: Rng;
  /** 9 cells: -1 empty, else the seat (0 or 1) that took it. */
  cells: number[];
  turnSeat: number;
  turnId: number;
  /** First mover of this game (a rematch starts with the other seat). */
  first: number;
  winner: number | null;
  draw: boolean;
  secrets: [number, number];
}

export type ToyEvent = { type: 'take'; seat: number; cell: number } | { type: 'timeout'; seat: number };
export interface ToyView extends Omit<ToyState, 'secrets' | 'rng'> { secrets: [number | null, number | null] }

const LINES = [[0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6], [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6]] as const;
const SEATS = [0, 1] as const;

function winnerOf(cells: readonly number[]): number | null {
  for (const [a, b, c] of LINES) {
    const v = cells[a] ?? -1;
    if (v >= 0 && v === cells[b] && v === cells[c]) return v;
  }
  return null;
}

function start(config: ToyConfig, seed: number, first: number | null): ToyState {
  const [pick, r1] = nextInt({ seed }, 2);
  const [s0, r2] = nextInt(r1, 100);
  const [s1, rng] = nextInt(r2, 100);
  const firstSeat = first ?? pick;
  return {
    config, seed, rng, cells: Array<number>(9).fill(-1), turnSeat: firstSeat, turnId: 0, first: firstSeat,
    winner: null, draw: false, secrets: [s0, s1],
  };
}

function take(s: ToyState, seat: number, cell: number): ToyState {
  const cells = s.cells.map((v, i) => (i === cell ? seat : v));
  const winner = winnerOf(cells);
  return {
    ...s, cells, winner, draw: winner === null && cells.every((v) => v >= 0),
    turnSeat: 1 - seat, turnId: s.turnId + 1,
  };
}

const firstFree = (s: ToyState): number => s.cells.indexOf(-1);
const over = (s: ToyState): boolean => s.winner !== null || s.draw;

/** HUB-1 toy: tic-tac-toe for seats 0 and 1, plus a per-seat secret to test hidden views (HUB-5). */
export const toyGame: GameModule<ToyConfig, ToyState, { cell: number }, ToyEvent, ToyView> = {
  id: 'toy',
  hasHiddenInfo: false,
  configSchema: z.object({ hidden: z.boolean() }),
  moveSchema: z.object({ cell: z.number().int().min(0).max(8) }),
  seats: () => SEATS,
  teamOf: (_c, seat) => String(seat),
  configOf: (s) => s.config,
  newGame: (config, seed) => start(config, seed, null),
  rematch: (s) => start(s.config, (s.seed + 1) >>> 0, 1 - s.first),
  applyMove(s, seat, turnId, move) {
    if (over(s)) return refuse('GAME_OVER', 'The game is over');
    if (seat !== s.turnSeat) return refuse('NOT_YOUR_TURN', 'It is not your turn');
    if (turnId !== s.turnId) return refuse('STALE_TURN', `Expected turn ${s.turnId}`);
    if ((s.cells[move.cell] ?? 0) !== -1) return refuse('BAD_MOVE', 'That cell is taken');
    return { ok: true, state: take(s, seat, move.cell), events: [{ type: 'take', seat, cell: move.cell }], durationMs: 0 };
  },
  timeout(s) {
    const seat = s.turnSeat;
    return { state: take(s, seat, firstFree(s)), seat, events: [{ type: 'timeout', seat }] };
  },
  takeovers: () => [],
  turnSeat: (s) => s.turnSeat,
  turnId: (s) => s.turnId,
  result(s) {
    if (s.winner !== null) return { winner: String(s.winner), placings: SEATS.map((x) => (x === s.winner ? 1 : 2)) };
    return s.draw ? { winner: '', placings: [1, 1] } : null;
  },
  view(s, seat) {
    const rest = {
      config: s.config, seed: s.seed, cells: s.cells, turnSeat: s.turnSeat, turnId: s.turnId, first: s.first,
      winner: s.winner, draw: s.draw,
    };
    const { secrets } = s;
    if (!s.config.hidden) return { ...rest, secrets };
    return { ...rest, secrets: [seat === 0 ? secrets[0] : null, seat === 1 ? secrets[1] : null] };
  },
  hash: (s) => `${s.cells.join('')}:${s.turnSeat}:${s.turnId}`,
  rounds: () => 1,
  bot: (s) => ({ cell: firstFree(s) }),
};

/** The same toy under another id: a second game for "queues never mix games" tests. */
export const toyGame2: typeof toyGame = { ...toyGame, id: 'toy2' };

/** The toy with hidden secrets switched on. */
export const hiddenToyGame: typeof toyGame = { ...toyGame, id: 'toyHidden', hasHiddenInfo: true };
