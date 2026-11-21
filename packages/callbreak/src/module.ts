import { isCard, type Card } from '@hub/cards';
import type { GameModule } from '@hub/game-kit';
import { z } from 'zod';
import { callbreakBot } from './bot';
import { CB } from './config';
import { applyCallbreakMove, callbreakResult, finish, newCallbreak, nextSeat, SEATS, step } from './rules';
import type { CallbreakConfig, CallbreakEvent, CallbreakMove, CallbreakState, CallbreakView } from './types';

export const CallbreakConfigSchema: z.ZodType<CallbreakConfig> = z.object({
  rounds: z.union([z.literal(3), z.literal(5)]),
  redeal: z.boolean(),
});

export const CallbreakMoveSchema: z.ZodType<CallbreakMove> = z.union([
  z.object({ bid: z.number().int().min(CB.MIN_BID).max(CB.MAX_BID) }).strict(),
  z.object({ card: z.custom<Card>(isCard) }).strict(),
]);

/** CB-3 / CB-4 defaults: 5 rounds, redeal on. */
export const DEFAULT_CALLBREAK_CONFIG: CallbreakConfig = { rounds: 5, redeal: true };

/** CB-5 a seat's view: its own hand and everything public; a spectator (null) sees no hand. */
export function callbreakView(s: CallbreakState, seat: number | null): CallbreakView {
  const pub: Partial<CallbreakState> = { ...s };
  delete pub.rng;
  delete pub.seed;
  delete pub.hands;
  const own = seat !== null ? s.hands[seat] ?? [] : [];
  return { ...(pub as Omit<CallbreakState, 'rng' | 'seed' | 'hands'>), seat, hand: [...own], handSizes: s.hands.map((h) => h.length) };
}

/** CB-4 the clock ran out: the seat plays what the medium bot would (from its own view); two in a row → bot takeover. */
export function callbreakTimeout(s: CallbreakState): { state: CallbreakState; seat: number; events: CallbreakEvent[] } {
  const seat = s.turnSeat;
  const count = (s.timeouts[seat] ?? 0) + 1;
  const events: CallbreakEvent[] = [{ type: 'timeout', seat }];
  if (count === CB.TIMEOUTS_FOR_BOT) events.push({ type: 'botTakeover', seat });
  const timed: CallbreakState = { ...s, timeouts: s.timeouts.map((n, i) => (i === seat ? count : n)) };
  if (s.winner !== null) return { state: s, seat, events: [] };
  const next = step(timed, seat, callbreakBot(callbreakView(s, seat), 'medium', s.turnId), events);
  return { state: finish(typeof next === 'string' ? timed : next, events), seat, events };
}

/** CB-2 Callbreak on the hub's game contract. Hands are hidden: the room sends each seat its own view. */
export const callbreakModule: GameModule<CallbreakConfig, CallbreakState, CallbreakMove, CallbreakEvent, CallbreakView> = {
  id: 'callbreak',
  hasHiddenInfo: true,
  configSchema: CallbreakConfigSchema,
  moveSchema: CallbreakMoveSchema,
  seats: () => SEATS,
  teamOf: (_c, seat) => String(seat),
  configOf: (s) => s.config,
  newGame: (c, seed) => newCallbreak(c, seed),
  rematch: (s) => newCallbreak(s.config, (s.seed + 1) >>> 0, nextSeat(s.dealer)),
  applyMove: applyCallbreakMove,
  timeout: callbreakTimeout,
  takeovers: (events) => events.flatMap((e) => (e.type === 'botTakeover' ? [e.seat] : [])),
  turnSeat: (s) => s.turnSeat,
  turnId: (s) => s.turnId,
  result: callbreakResult,
  view: callbreakView,
  /** CB-5 covers the full state, hands included, so it stays on the server. */
  hash: (s) => `${s.hands.map((h) => h.join('')).join('|')}:${s.trick.map((p) => p.card).join('')}:${s.bids.join(',')}:${s.won.join(',')}:${s.scores.flat().join(',')}:${s.round}:${s.turnSeat}:${s.turnId}:${s.phase}`,
  rounds: (s) => s.scores.length,
  bot: (s, seat, level, seed) => callbreakBot(callbreakView(s, seat), level, seed),
};
