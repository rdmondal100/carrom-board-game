import { beats, deal, rankOf, suitOf, winningPlay, type Card, type Play, type Suit } from '@hub/cards';
import { nextInt, refuse, type GameResult, type MoveOutcome, type Rng } from '@hub/game-kit';
import { CB, CB_ANIM } from './config';
import type { CallbreakConfig, CallbreakEvent, CallbreakMove, CallbreakState } from './types';

/** CB-2 spades are always trumps. */
export const TRUMP: Suit = 'S';
export const SEATS: readonly number[] = [0, 1, 2, 3];
export const nextSeat = (seat: number): number => (seat + 1) % CB.SEATS;

/** CB-4 a hand with no spade and no face card (J, Q, K) is thrown in. */
export function needsRedeal(hand: readonly Card[]): boolean {
  return !hand.some((c) => suitOf(c) === TRUMP || (CB.FACE_RANKS as readonly number[]).includes(rankOf(c)));
}

/**
 * CB-2 the cards `hand` may play on `trick`: follow the led suit and beat the
 * winning card if able; when void, play a spade that wins if able; else anything.
 */
export function legalCards(hand: readonly Card[], trick: readonly Play[]): Card[] {
  const best = winningPlay(trick, TRUMP);
  if (!best) return [...hand];
  const led = suitOf(trick[0]!.card);
  const follow = hand.filter((c) => suitOf(c) === led);
  if (follow.length > 0) {
    if (suitOf(best.card) !== led) return follow; // trumped already: any card of the suit
    const higher = follow.filter((c) => rankOf(c) > rankOf(best.card));
    return higher.length > 0 ? higher : follow;
  }
  const trumps = hand.filter((c) => suitOf(c) === TRUMP && beats(c, best.card, led, TRUMP));
  return trumps.length > 0 ? trumps : [...hand];
}

/** CB-3 one round's points in tenths: made = call + 0.1 per extra trick; failed = minus the call. */
export function roundPoints(bid: number, won: number): number {
  return won >= bid ? bid * CB.POINT + (won - bid) : -bid * CB.POINT;
}

/** Total points per seat (tenths) over the finished rounds. */
export const totalsOf = (scores: readonly (readonly number[])[]): number[] =>
  SEATS.map((s) => scores.reduce((sum, r) => sum + (r[s] ?? 0), 0));

/** Deal a round (CB-4 redeals while a hand must be thrown in); the seat after the dealer calls first. */
function startRound(s: CallbreakState, round: number, dealer: number, events: CallbreakEvent[]): CallbreakState {
  let rng: Rng = s.rng;
  let hands: Card[][];
  let redeals = -1;
  do {
    [hands, rng] = deal(rng, CB.SEATS, CB.HAND);
    redeals++;
  } while (s.config.redeal && redeals < CB.MAX_REDEALS && hands.some(needsRedeal));
  events.push({ type: 'deal', round, dealer, redeals });
  return {
    ...s, rng, round, dealer, hands, phase: 'bid', bids: SEATS.map(() => null), won: SEATS.map(() => 0),
    trick: [], tricks: [], turnSeat: nextSeat(dealer),
  };
}

/** CB-2 a new game; the seed picks the first dealer (a rematch passes the next one). */
export function newCallbreak(config: CallbreakConfig, seed: number, dealer: number | null = null): CallbreakState {
  const [pick, rng] = nextInt({ seed: seed >>> 0 }, CB.SEATS);
  const base: CallbreakState = {
    config, seed: seed >>> 0, rng, round: 0, dealer: dealer ?? pick, phase: 'bid', hands: [], bids: [], won: [],
    trick: [], tricks: [], scores: [], turnSeat: 0, turnId: 0, timeouts: SEATS.map(() => 0), winner: null, recent: [],
  };
  const events: CallbreakEvent[] = [];
  const s = startRound(base, 1, base.dealer, events);
  return { ...s, recent: events };
}

/** Highest total wins (a tie goes to the lower seat; placings share). */
function winnerOf(scores: readonly (readonly number[])[]): number {
  const totals = totalsOf(scores);
  return SEATS.reduce((best, s) => (totals[s]! > totals[best]! ? s : best), 0);
}

function endRound(s: CallbreakState, events: CallbreakEvent[]): CallbreakState {
  const points = SEATS.map((x) => roundPoints(s.bids[x] ?? CB.MIN_BID, s.won[x] ?? 0));
  const scores = [...s.scores, points];
  events.push({ type: 'roundEnd', round: s.round, points });
  if (scores.length >= s.config.rounds) {
    const winner = String(winnerOf(scores));
    events.push({ type: 'win', winner });
    return { ...s, scores, phase: 'over', winner };
  }
  return startRound({ ...s, scores }, s.round + 1, nextSeat(s.dealer), events);
}

function bid(s: CallbreakState, seat: number, call: number, events: CallbreakEvent[]): CallbreakState {
  events.push({ type: 'bid', seat, bid: call });
  const bids = s.bids.map((b, i) => (i === seat ? call : b));
  const allIn = bids.every((b) => b !== null);
  // Everyone has called: the seat after the dealer leads the first trick.
  return { ...s, bids, phase: allIn ? 'play' : 'bid', turnSeat: allIn ? nextSeat(s.dealer) : nextSeat(seat) };
}

function play(s: CallbreakState, seat: number, card: Card, events: CallbreakEvent[]): CallbreakState {
  events.push({ type: 'play', seat, card });
  const hands = s.hands.map((h, i) => (i === seat ? h.filter((c) => c !== card) : h));
  const trick = [...s.trick, { seat, card }];
  if (trick.length < CB.SEATS) return { ...s, hands, trick, turnSeat: nextSeat(seat) };
  const winner = winningPlay(trick, TRUMP)!.seat;
  events.push({ type: 'trick', winner });
  const next: CallbreakState = {
    ...s, hands, trick: [], tricks: [...s.tricks, trick], won: s.won.map((n, i) => (i === winner ? n + 1 : n)), turnSeat: winner,
  };
  return hands.every((h) => h.length === 0) ? endRound(next, events) : next;
}

/** CB-4 the move's effect, or why it is refused (nothing changes then). Turn and clock checks are the caller's. */
export function step(s: CallbreakState, seat: number, move: CallbreakMove, events: CallbreakEvent[]): CallbreakState | string {
  if ('bid' in move) {
    if (s.phase !== 'bid') return 'Not bidding now';
    if (!Number.isInteger(move.bid) || move.bid < CB.MIN_BID || move.bid > CB.MAX_BID) return `Call ${CB.MIN_BID}–${CB.MAX_BID}`;
    return bid(s, seat, move.bid, events);
  }
  if (s.phase !== 'play') return 'Call first';
  const hand = s.hands[seat] ?? [];
  if (!hand.includes(move.card)) return 'That card is not in your hand';
  if (!legalCards(hand, s.trick).includes(move.card)) return 'That card is not allowed now';
  return play(s, seat, move.card, events);
}

/** How long the client shows these events; the clock starts after. */
export function durationOf(events: readonly CallbreakEvent[]): number {
  const ms: Partial<Record<CallbreakEvent['type'], number>> = {
    deal: CB_ANIM.DEAL_MS, bid: CB_ANIM.BID_MS, play: CB_ANIM.CARD_MS, trick: CB_ANIM.TRICK_MS, roundEnd: CB_ANIM.ROUND_MS,
  };
  return events.reduce((sum, e) => sum + (ms[e.type] ?? 0), 0);
}

export const finish = (s: CallbreakState, events: CallbreakEvent[]): CallbreakState => ({ ...s, turnId: s.turnId + 1, recent: events });

/** CB-4 a move from `seat`. Refused moves change nothing. */
export function applyCallbreakMove(
  s: CallbreakState, seat: number, turnId: number, move: CallbreakMove,
): MoveOutcome<CallbreakState, CallbreakEvent> {
  if (s.winner !== null) return refuse('GAME_OVER', 'The game is over');
  if (seat !== s.turnSeat) return refuse('NOT_YOUR_TURN', 'It is not your turn');
  if (turnId !== s.turnId) return refuse('STALE_TURN', `Expected turn ${s.turnId}`);
  const events: CallbreakEvent[] = [];
  const timeouts = s.timeouts.map((n, i) => (i === seat ? 0 : n));
  const next = step({ ...s, timeouts }, seat, move, events);
  if (typeof next === 'string') return refuse('BAD_MOVE', next);
  return { ok: true, state: finish(next, events), events, durationMs: durationOf(events) };
}

/** CB-3 the finished game: highest total first; equal totals share a place. */
export function callbreakResult(s: CallbreakState): GameResult | null {
  if (s.winner === null) return null;
  const totals = totalsOf(s.scores);
  return { winner: s.winner, placings: SEATS.map((x) => 1 + SEATS.filter((o) => totals[o]! > totals[x]!).length) };
}
