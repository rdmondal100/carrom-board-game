// NODI-2 Nodi Par as a state machine: launch / flick, whirlpools, rounds, match.
import {
  config as engine, NODI, seatOutward, seatRight, seatToWorld, simulateFlick, spotIsFree,
  type BoardState, type Seat, type ShotResult,
} from '@carrom/engine';
import { nextInt, refuse, type GameResult, type MoveOutcome } from '@hub/game-kit';
import { NODI_ANIM, NODI_RULES } from './config';
import { boatId, boatOf, emptyRiver, layoutOf, seatsOf, standing, tableOf, teamOf, TEAMS } from './islands';
import type { NodiConfig, NodiEvent, NodiMove, NodiState, RoundResult, Team } from './types';

const SEAT_SLOTS = 4;
/** Moves per player per round. */
export const TURNS = NODI_RULES.LAUNCHES + NODI_RULES.EXTRA_FLICKS;

/** Next seat in play order (turns pass to the right, like carrom). */
export function nextSeatOf(c: NodiConfig, seat: number): number {
  const seats = seatsOf(c);
  return seats[(seats.indexOf(seat) + 1) % seats.length]!;
}

/** NODI-2 a new match; `first` (default: from the seed) moves first in round 1. */
export function newNodi(config: NodiConfig, seed: number, first?: number): NodiState {
  const seats = seatsOf(config);
  const firstSeat = first ?? seats[nextInt({ seed }, seats.length)[0]]!;
  const board = emptyRiver(config);
  return {
    config, seed, board, turnSeat: firstSeat, turnId: 0, round: 1, roundFirst: firstSeat, first: firstSeat,
    moves: Array<number>(SEAT_SLOTS).fill(0), timeouts: Array<number>(SEAT_SLOTS).fill(0),
    ...standing(board, config), results: [], winner: null,
  };
}

/** World position of launch spot `x` along the seat's bank (+ = the player's right). */
export function launchPoint(seat: number, x: number): { x: number; y: number } {
  const o = seatOutward(seat as Seat);
  const r = seatRight(seat as Seat);
  const d = engine.HALF_L - NODI.BANK_INSET;
  return { x: o.x * d + r.x * x, y: o.y * d + r.y * x };
}

function boatsWhere(s: NodiState, seat: number, pocketed: boolean): number[] {
  const out: number[] = [];
  for (let k = 0; k < NODI_RULES.BOATS; k++) {
    const p = s.board.pieces.find((q) => q.id === boatId(seat, k));
    if (p && p.pocketed === pocketed) out.push(k);
  }
  return out;
}

/** Boats of `seat` still in hand on the bank, lowest number first. */
export const inHand = (s: NodiState, seat: number): number[] => boatsWhere(s, seat, true);
/** Boats of `seat` on the river. */
export const onRiver = (s: NodiState, seat: number): number[] => boatsWhere(s, seat, false);

/** The board with the move's boat in place and that boat's id, or why the move can't be played. */
export function setUp(s: NodiState, seat: number, move: NodiMove): { board: BoardState; id: string } | string {
  if (move.kind === 'launch') {
    const k = inHand(s, seat)[0];
    if (k === undefined) return 'No boat left in hand';
    if (!(Math.abs(move.x) <= layoutOf(s.config).bankHalf)) return 'Launch spot is off the bank';
    const at = launchPoint(seat, move.x);
    const id = boatId(seat, k);
    if (!spotIsFree(s.board, at.x, at.y, NODI.BOAT_D / 2, tableOf(s.config), id)) return 'Launch spot is blocked';
    return { board: { pieces: s.board.pieces.map((p) => (p.id === id ? { ...p, x: at.x, y: at.y, pocketed: false } : p)) }, id };
  }
  if (!onRiver(s, seat).includes(move.boat)) return 'That boat is not on the river';
  return { board: s.board, id: boatId(seat, move.boat) };
}

export interface Aimed { board: BoardState; id: string; vx: number; vy: number }

/** The board with the move's boat in place and the world velocity it gets. Throws RangeError on a move that can't be played. */
export function aimedStart(s: NodiState, seat: number, move: NodiMove): Aimed {
  const set = setUp(s, seat, move);
  if (typeof set === 'string') throw new RangeError(set);
  const len = Math.sqrt(move.dirX * move.dirX + move.dirY * move.dirY);
  if (!(len > 0) || !Number.isFinite(len) || !Number.isFinite(move.power)) throw new RangeError('Bad aim');
  const power = Math.min(NODI_RULES.MAX_POWER, Math.max(NODI_RULES.MIN_POWER, move.power));
  const dir = seatToWorld(seat as Seat, move.dirX / len, move.dirY / len);
  const speed = NODI.MAX_SPEED * power;
  return { ...set, vx: dir.x * speed, vy: dir.y * speed };
}

/** Run the physics of a move for `seat` (no rules applied). Throws RangeError on a move that can't be played. */
export function flickOf(s: NodiState, seat: number, move: NodiMove): ShotResult & { start: BoardState; id: string } {
  const a = aimedStart(s, seat, move);
  const sim = simulateFlick(a.board, a.id, a.vx, a.vy, tableOf(s.config));
  return { ...sim, start: a.board, id: a.id };
}

function islandEvents(before: NodiState, after: Pick<NodiState, 'owners' | 'pars'>, events: NodiEvent[]): void {
  after.owners.forEach((o, i) => {
    if (o !== before.owners[i]) events.push({ type: 'island', island: i, owner: o });
  });
  for (const t of TEAMS) {
    if (after.pars[t].length > 0 && before.pars[t].length === 0) events.push({ type: 'par', team: t, islands: after.pars[t] });
  }
}

/**
 * Winner of the match after these rounds, or null to play on: two round wins;
 * after ROUNDS more wins, then more points; still level, play on to
 * MAX_ROUNDS, then the side that moved first in round 1.
 */
export function matchWinner(results: readonly RoundResult[], first: Team): Team | null {
  const wins = { A: 0, B: 0 };
  const total = { A: 0, B: 0 };
  for (const r of results) {
    if (r.winner) wins[r.winner]++;
    for (const t of TEAMS) total[t] += r.points[t];
  }
  for (const t of TEAMS) if (wins[t] >= NODI_RULES.ROUNDS_TO_WIN) return t;
  if (results.length < NODI_RULES.ROUNDS) return null;
  if (wins.A !== wins.B) return wins.A > wins.B ? 'A' : 'B';
  if (total.A !== total.B) return total.A > total.B ? 'A' : 'B';
  return results.length >= NODI_RULES.MAX_ROUNDS ? first : null;
}

/** After a move or a lost move: count it, pass the turn, end the round / match when everyone is done. */
function afterMove(s: NodiState, seat: number, events: NodiEvent[]): NodiState {
  const moves = s.moves.map((n, i) => (i === seat ? n + 1 : n));
  const next: NodiState = { ...s, moves, turnSeat: nextSeatOf(s.config, seat), turnId: s.turnId + 1 };
  if (!seatsOf(s.config).every((q) => (moves[q] ?? 0) >= TURNS)) return next;

  const { live } = next;
  const winner: Team | null = live.A > live.B ? 'A' : live.B > live.A ? 'B' : null;
  const result: RoundResult = { round: s.round, points: { ...live }, winner };
  events.push({ type: 'roundEnd', result });
  const results = [...s.results, result];
  const champ = matchWinner(results, teamOf(s.config, s.first));
  if (champ) {
    events.push({ type: 'win', winner: champ });
    return { ...next, results, winner: champ };
  }
  const roundFirst = nextSeatOf(s.config, s.roundFirst);
  const board = emptyRiver(s.config);
  return {
    ...next, results, round: s.round + 1, roundFirst, turnSeat: roundFirst, board,
    moves: Array<number>(SEAT_SLOTS).fill(0), ...standing(board, s.config),
  };
}

/** NODI-2 play a move for the seat claiming `turnId`. Refused moves change nothing. */
export function applyNodiMove(s: NodiState, seat: number, turnId: number, move: NodiMove): MoveOutcome<NodiState, NodiEvent> {
  if (s.winner) return refuse('GAME_OVER', 'The game is over');
  if (seat !== s.turnSeat) return refuse('NOT_YOUR_TURN', 'It is not your turn');
  if (turnId !== s.turnId) return refuse('STALE_TURN', `Expected turn ${s.turnId}`);
  let sim: ReturnType<typeof flickOf>;
  try {
    sim = flickOf(s, seat, move);
  } catch (err) {
    if (err instanceof RangeError) return refuse('BAD_MOVE', err.message);
    throw err;
  }
  const events: NodiEvent[] = [];
  const { boat } = boatOf(sim.id);
  if (move.kind === 'launch') {
    const at = sim.start.pieces.find((p) => p.id === sim.id)!;
    events.push({ type: 'launch', seat, boat, x: at.x, y: at.y });
  } else {
    events.push({ type: 'flick', seat, boat });
  }
  events.push({ type: 'shot', events: sim.events });
  // A boat in a whirlpool returns to its owner's bank: it stays pocketed, which is "in hand".
  for (const e of sim.events) {
    if (e.type === 'pocket') events.push({ type: 'whirlpool', ...boatOf(e.id) });
  }
  const st = standing(sim.final, s.config);
  islandEvents(s, st, events);
  const timeouts = s.timeouts.map((n, i) => (i === seat ? 0 : n));
  const state = afterMove({ ...s, board: sim.final, timeouts, ...st }, seat, events);
  const roundEnded = events.some((e) => e.type === 'roundEnd');
  return { ok: true, state, events, durationMs: sim.durationMs + (roundEnded ? NODI_ANIM.ROUND_END_MS : 0) };
}

/** The clock ran out: the seat loses that move; the second in a row hands the seat to the bot. */
export function nodiTimeout(s: NodiState): { state: NodiState; seat: number; events: NodiEvent[] } {
  const seat = s.turnSeat;
  const count = (s.timeouts[seat] ?? 0) + 1;
  const events: NodiEvent[] = [{ type: 'timeout', seat }];
  if (count === NODI_RULES.TIMEOUTS_FOR_BOT) events.push({ type: 'botTakeover', seat });
  const state = afterMove({ ...s, timeouts: s.timeouts.map((n, i) => (i === seat ? count : n)) }, seat, events);
  return { state, seat, events };
}

export function nodiResult(s: NodiState): GameResult | null {
  if (!s.winner) return null;
  return { winner: s.winner, placings: seatsOf(s.config).map((q) => (teamOf(s.config, q) === s.winner ? 1 : 2)) };
}
