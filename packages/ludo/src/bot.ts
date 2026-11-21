import { nextInt, type BotLevel } from '@hub/game-kit';
import { isSafe, legalTokens, sameSide, seatsOf, squareOf, target, victimsAt } from './board';
import { LUDO, LUDO_BOT } from './config';
import type { LudoMove, LudoState, LudoView } from './types';

type Board = Pick<LudoView, 'config' | 'tokens'>;

/**
 * Chance (roughly, 1/6 per threat) that a token of `seat` on track square
 * `square` is captured before its next turn: opponents' track tokens 1..6
 * squares behind it on their own way round.
 */
export function danger(b: Board, seat: number, square: number): number {
  if (square < 0 || isSafe(square)) return 0;
  let threats = 0;
  for (const opp of seatsOf(b.config)) {
    if (sameSide(b.config, opp, seat)) continue;
    for (const p of b.tokens[opp] ?? []) {
      if (p < 0 || p > LUDO.LAST_TRACK) continue;
      for (let d = 1; d <= LUDO.DIE_SIDES; d++) {
        if (p + d <= LUDO.LAST_TRACK && squareOf(opp, p + d) === square) threats++;
      }
    }
  }
  return Math.min(1, threats / LUDO.DIE_SIDES);
}

/** LUDO-5 score of moving `token` with `dice`; `lookahead` adds the 1-ply capture risk (hard). */
export function scoreMove(b: Board, seat: number, token: number, dice: number, lookahead: boolean): number {
  const from = b.tokens[seat]![token]!;
  const to = target(b, seat, from, dice)!;
  const sq = squareOf(seat, to);
  let score = to * LUDO_BOT.PROGRESS;
  if (to === LUDO.HOME) score += LUDO_BOT.FINISH;
  if (victimsAt(b, sq, seat).length > 0) score += LUDO_BOT.CAPTURE;
  if (from === LUDO.YARD) score += LUDO_BOT.LEAVE_YARD;
  if (from <= LUDO.LAST_TRACK && to > LUDO.LAST_TRACK && to < LUDO.HOME) score += LUDO_BOT.ENTER_COLUMN;
  if (sq >= 0 && isSafe(sq)) score += LUDO_BOT.SAFE;
  if (lookahead) {
    const tokens = b.tokens.map((l, s) => (s === seat ? l.map((p, i) => (i === token ? to : p)) : l));
    for (const [v, i] of victimsAt(b, sq, seat)) tokens[v]![i] = LUDO.YARD;
    const after = { config: b.config, tokens };
    // Risk to the moved token (weighted by what it would lose) against the risk it escapes.
    const before = danger(b, seat, squareOf(seat, from)) * Math.max(0, from);
    const risk = danger(after, seat, sq) * Math.max(0, to);
    score += (LUDO_BOT.DANGER * (before - risk)) / LUDO.LAST_TRACK;
  }
  return score;
}

/** LUDO-5 easy = a random legal token, medium = the best score, hard = the best score with danger. */
export function ludoBot(s: LudoState, seat: number, level: BotLevel, seed: number): LudoMove {
  if (s.phase === 'roll' || s.dice === null) return { roll: true };
  const legal = legalTokens(s, seat, s.dice);
  if (legal.length === 0) return { token: 0 };
  if (level === 'easy') return { token: legal[nextInt({ seed: seed >>> 0 }, legal.length)[0]]! };
  const lookahead = level === 'hard';
  let best = legal[0]!;
  let bestScore = -Infinity;
  for (const t of legal) {
    const sc = scoreMove(s, seat, t, s.dice, lookahead);
    if (sc > bestScore) [best, bestScore] = [t, sc];
  }
  return { token: best };
}
