import { nextInt, refuse, type GameResult, type MoveOutcome } from '@hub/game-kit';
import { legalTokens, progressOf, seatDone, seatsOf, squareOf, target, teamOf, victimsAt } from './board';
import { LUDO, LUDO_ANIM } from './config';
import type { LudoConfig, LudoEvent, LudoMove, LudoState } from './types';

const SEAT_SLOTS = 4;

/** Next seat clockwise that still plays (2v2: a partner who is home is skipped). */
export function nextSeat(s: LudoState, seat: number): number {
  const seats = seatsOf(s.config);
  const i = seats.indexOf(seat);
  for (let k = 1; k <= seats.length; k++) {
    const n = seats[(i + k) % seats.length]!;
    if (!seatDone(s, n)) return n;
  }
  return seat;
}

/** The seat after `seat` in table order (rematch: the next seat rolls first). */
export function nextSeatOf(c: LudoConfig, seat: number): number {
  const seats = seatsOf(c);
  return seats[(seats.indexOf(seat) + 1) % seats.length]!;
}

/** Hand the turn to `seat`: tap to roll waits for a `roll`; otherwise the server rolls now. */
function startTurn(s: LudoState, seat: number, events: LudoEvent[]): LudoState {
  const fresh: LudoState = { ...s, turnSeat: seat, sixes: seat === s.turnSeat ? s.sixes : 0, phase: 'roll', dice: null };
  return fresh.config.tapToRoll ? fresh : roll(fresh, events);
}

/**
 * LUDO-3 roll for the seat on turn. Three 6s in a row or no legal token pass the
 * turn (and the next seat rolls, unless tap to roll). After MAX_AUTO_PASSES the
 * game waits for a `roll` move instead of looping.
 */
export function roll(start: LudoState, events: LudoEvent[]): LudoState {
  let s = start;
  for (let passes = 0; passes < LUDO.MAX_AUTO_PASSES; passes++) {
    const [face, rng] = nextInt(s.rng, LUDO.DIE_SIDES);
    const value = face + 1;
    const seat = s.turnSeat;
    events.push({ type: 'roll', seat, value });
    const sixes = value === LUDO.SIX ? s.sixes + 1 : 0;
    s = { ...s, rng, sixes };
    let reason: 'threeSixes' | 'noMove' | null = null;
    if (sixes >= LUDO.SIXES_LOSE) reason = 'threeSixes';
    else if (legalTokens(s, seat, value).length === 0) reason = 'noMove';
    if (reason === null) return { ...s, phase: 'move', dice: value };
    events.push({ type: 'pass', seat, reason });
    const next = nextSeat(s, seat);
    s = { ...s, turnSeat: next, sixes: 0, phase: 'roll', dice: null };
    if (s.config.tapToRoll) return s;
  }
  return s;
}

/** LUDO-1 a new game: the seed picks who rolls first. */
export function newLudo(config: LudoConfig, seed: number, first: number | null = null): LudoState {
  const seats = seatsOf(config);
  const [pick, rng] = nextInt({ seed: seed >>> 0 }, seats.length);
  const firstSeat = first ?? seats[pick]!;
  const base: LudoState = {
    config, seed: seed >>> 0, rng,
    tokens: Array.from({ length: SEAT_SLOTS }, (_, i) => (seats.includes(i) ? Array<number>(LUDO.TOKENS).fill(LUDO.YARD) : [])),
    turnSeat: firstSeat, turnId: 0, phase: 'roll', dice: null, sixes: 0,
    timeouts: Array<number>(SEAT_SLOTS).fill(0), first: firstSeat, winner: null, recent: [],
  };
  const events: LudoEvent[] = [];
  const s = startTurn(base, firstSeat, events);
  return { ...s, recent: events };
}

/** The winning side, once one has finished (2v2: both partners). */
function winnerOf(s: LudoState): string | null {
  for (const seat of seatsOf(s.config)) {
    const side = teamOf(s.config, seat);
    const mates = seatsOf(s.config).filter((x) => teamOf(s.config, x) === side);
    if (mates.every((m) => seatDone(s, m))) return side;
  }
  return null;
}

/** Move `token` of the seat on turn by the rolled dice (already checked legal). */
function moveToken(s: LudoState, token: number, events: LudoEvent[]): LudoState {
  const seat = s.turnSeat;
  const dice = s.dice!;
  const from = s.tokens[seat]![token]!;
  const to = target(s, seat, from, dice)!;
  const tokens = s.tokens.map((l) => [...l]);
  tokens[seat]![token] = to;
  events.push({ type: 'move', seat, token, from, to });
  const victims = victimsAt(s, squareOf(seat, to), seat);
  for (const [v, i] of victims) {
    events.push({ type: 'capture', seat, victim: v, token: i, from: tokens[v]![i]! });
    tokens[v]![i] = LUDO.YARD; // capture sends the token back to its yard
  }
  const home = to === LUDO.HOME;
  if (home) events.push({ type: 'home', seat, token });
  let next: LudoState = { ...s, tokens, phase: 'roll', dice: null };
  const winner = winnerOf(next);
  if (winner !== null) {
    events.push({ type: 'win', winner });
    return { ...next, winner };
  }
  // LUDO-2 a 6, a capture or reaching home gives another roll.
  const again = dice === LUDO.SIX || victims.length > 0 || home;
  if (again && !seatDone(next, seat)) {
    if (dice !== LUDO.SIX) next = { ...next, sixes: 0 };
    return startTurn(next, seat, events);
  }
  return startTurn(next, nextSeat(next, seat), events);
}

/** LUDO-6 how long the client shows these events; the clock starts after. */
export function durationOf(events: readonly LudoEvent[]): number {
  let ms = 0;
  for (const e of events) {
    if (e.type === 'roll') ms += LUDO_ANIM.DICE_MS;
    else if (e.type === 'move') ms += LUDO_ANIM.HOP_MS * Math.max(1, e.to - Math.max(e.from, 0));
    else if (e.type === 'capture') ms += LUDO_ANIM.CAPTURE_MS;
    else if (e.type === 'pass') ms += LUDO_ANIM.PASS_MS;
  }
  return ms;
}

const done = (s: LudoState, events: LudoEvent[]): LudoState => ({ ...s, turnId: s.turnId + 1, recent: events });

/** LUDO-3 a move from `seat`. Refused moves change nothing. */
export function applyLudoMove(s: LudoState, seat: number, turnId: number, move: LudoMove): MoveOutcome<LudoState, LudoEvent> {
  if (s.winner !== null) return refuse('GAME_OVER', 'The game is over');
  if (seat !== s.turnSeat) return refuse('NOT_YOUR_TURN', 'It is not your turn');
  if (turnId !== s.turnId) return refuse('STALE_TURN', `Expected turn ${s.turnId}`);
  const events: LudoEvent[] = [];
  const timeouts = s.timeouts.map((n, i) => (i === seat ? 0 : n));
  let next: LudoState;
  if ('roll' in move) {
    if (s.phase !== 'roll') return refuse('BAD_MOVE', 'Already rolled');
    next = roll({ ...s, timeouts }, events);
  } else {
    if (s.phase !== 'move' || s.dice === null) return refuse('BAD_MOVE', 'Roll first');
    if (!legalTokens(s, seat, s.dice).includes(move.token)) return refuse('BAD_MOVE', 'That token cannot move');
    next = moveToken({ ...s, timeouts }, move.token, events);
  }
  return { ok: true, state: done(next, events), events, durationMs: durationOf(events) };
}

/** LUDO-4 the timed-out seat's auto-move: the furthest legal token (lowest index on a tie). */
export function furthestToken(s: LudoState): number | null {
  if (s.phase !== 'move' || s.dice === null) return null;
  const seat = s.turnSeat;
  const legal = legalTokens(s, seat, s.dice);
  if (legal.length === 0) return null;
  return legal.reduce((best, t) => (s.tokens[seat]![t]! > s.tokens[seat]![best]! ? t : best));
}

/** LUDO-4 the clock ran out: roll if needed, move the furthest token; two in a row → bot takeover. */
export function ludoTimeout(s: LudoState): { state: LudoState; seat: number; events: LudoEvent[] } {
  const seat = s.turnSeat;
  const count = (s.timeouts[seat] ?? 0) + 1;
  const events: LudoEvent[] = [{ type: 'timeout', seat }];
  if (count === LUDO.TIMEOUTS_FOR_BOT) events.push({ type: 'botTakeover', seat });
  let next: LudoState = { ...s, timeouts: s.timeouts.map((n, i) => (i === seat ? count : n)) };
  if (next.phase === 'roll') next = roll(next, events);
  const token = next.turnSeat === seat ? furthestToken(next) : null;
  if (token !== null) next = moveToken(next, token, events);
  return { state: done(next, events), seat, events };
}

/** The finished game: winners first; in free-for-all the rest by progress (ties share a place). */
export function ludoResult(s: LudoState): GameResult | null {
  if (s.winner === null) return null;
  const seats = seatsOf(s.config);
  if (s.config.teams) return { winner: s.winner, placings: seats.map((x) => (teamOf(s.config, x) === s.winner ? 1 : 2)) };
  const score = (x: number) => (String(x) === s.winner ? Infinity : progressOf(s, x));
  return { winner: s.winner, placings: seats.map((x) => 1 + seats.filter((o) => score(o) > score(x)).length) };
}
