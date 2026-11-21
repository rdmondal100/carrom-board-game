import { LUDO } from './config';
import type { LudoConfig, LudoView } from './types';

type Board = Pick<LudoView, 'config' | 'tokens'>;

/** LUDO-2 seats of a game: 2 players sit opposite; 3 and 4 take seats in order. */
export function seatsOf(c: Pick<LudoConfig, 'players'>): readonly number[] {
  if (c.players === 2) return [0, 2];
  return c.players === 3 ? [0, 1, 2] : [0, 1, 2, 3];
}

/** LUDO-2 team of a seat: 2v2 partners sit opposite ('A' = 0+2, 'B' = 1+3); else the seat itself. */
export function teamOf(c: Pick<LudoConfig, 'teams'>, seat: number): string {
  if (c.teams) return seat % 2 === 0 ? 'A' : 'B';
  return String(seat);
}

/** Seats on the same side never capture or block each other. */
export const sameSide = (c: LudoConfig, a: number, b: number): boolean => teamOf(c, a) === teamOf(c, b);

/** Shared track square (0..51) of a seat's token at track progress 0..50; -1 off the track. */
export function squareOf(seat: number, progress: number): number {
  if (progress < 0 || progress > LUDO.LAST_TRACK) return -1;
  return (seat * LUDO.QUARTER + progress) % LUDO.TRACK;
}

const SAFE = new Set(
  [0, 1, 2, 3].flatMap((s) => LUDO.SAFE_OFFSETS.map((o) => (s * LUDO.QUARTER + o) % LUDO.TRACK)),
);

/** LUDO-1 start and star squares: no capture there. */
export const isSafe = (square: number): boolean => SAFE.has(square);
export const SAFE_SQUARES: readonly number[] = [...SAFE].sort((a, b) => a - b);

/** Every token on a track square: [seat, token index]. */
export function tokensAt(b: Board, square: number): [number, number][] {
  const out: [number, number][] = [];
  b.tokens.forEach((list, seat) => list.forEach((p, i) => {
    if (squareOf(seat, p) === square) out.push([seat, i]);
  }));
  return out;
}

/**
 * LUDO-2 a blockade: two or more tokens of one seat on one square. `classic`
 * blocks on any track square, `bd` only on safe squares. It stops every token
 * of the other side: they may neither pass nor land there.
 */
export function blocks(b: Board, square: number, mover: number): boolean {
  if (b.config.preset === 'bd' && !isSafe(square)) return false;
  const count = new Map<number, number>();
  for (const [seat] of tokensAt(b, square)) {
    if (sameSide(b.config, seat, mover)) continue;
    const n = (count.get(seat) ?? 0) + 1;
    if (n >= 2) return true;
    count.set(seat, n);
  }
  return false;
}

/** Where a token at `from` lands with `roll`, or null when it can't move (LUDO-1 rules, both presets). */
export function target(b: Board, seat: number, from: number, roll: number): number | null {
  if (from === LUDO.HOME) return null;
  if (from === LUDO.YARD) {
    if (roll !== LUDO.SIX) return null;
    return blocks(b, squareOf(seat, 0), seat) ? null : 0;
  }
  let to = from + roll;
  if (to > LUDO.HOME) {
    if (b.config.preset === 'bd') return null; // exact roll to finish
    to = LUDO.HOME;
  }
  for (let p = from + 1; p <= Math.min(to, LUDO.LAST_TRACK); p++) {
    if (blocks(b, squareOf(seat, p), seat)) return null;
  }
  return to;
}

/** LUDO-3 tokens of `seat` that can move with `roll`. */
export function legalTokens(b: Board, seat: number, roll: number): number[] {
  return (b.tokens[seat] ?? []).flatMap((p, i) => (target(b, seat, p, roll) === null ? [] : [i]));
}

/** Tokens a token landing on track square `square` captures (none on safe squares). */
export function victimsAt(b: Board, square: number, mover: number): [number, number][] {
  if (square < 0 || isSafe(square)) return [];
  return tokensAt(b, square).filter(([seat]) => !sameSide(b.config, seat, mover));
}

/** Has this seat finished (all tokens home; quick mode: one)? */
export function seatDone(b: Board, seat: number): boolean {
  const home = (b.tokens[seat] ?? []).filter((p) => p === LUDO.HOME).length;
  return b.config.quick ? home >= 1 : home === LUDO.TOKENS;
}

/** Sum of progress (yard counts 0): placings and the bot's sense of who is ahead. */
export function progressOf(b: Board, seat: number): number {
  return (b.tokens[seat] ?? []).reduce((sum, p) => sum + Math.max(0, p + 1), 0);
}
