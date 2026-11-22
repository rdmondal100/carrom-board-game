import { applyNodiMove, newNodi, nodiBot, type NodiConfig, type NodiMove, type NodiState } from '@hub/nodipar';

/** NODI-6 the how-to's animated example: two medium bots, one round's opening, then it starts over. */
export const DEMO_CONFIG: NodiConfig = { players: 2, borsha: false };
export const DEMO_MOVES = 10;
const DEMO_SEED = 20;

export interface DemoStep { seat: number; move: NodiMove; next: NodiState }

export const demoStart = (): NodiState => newNodi(DEMO_CONFIG, DEMO_SEED, 0);

/** The next example move from `s` (the same every time), or null when the example starts over. */
export function demoStep(s: NodiState): DemoStep | null {
  if (s.turnId >= DEMO_MOVES || s.round > 1 || s.winner) return null;
  const seat = s.turnSeat;
  const move = nodiBot(s, seat, 'medium', DEMO_SEED * 100 + s.turnId);
  const out = applyNodiMove(s, seat, s.turnId, move);
  return out.ok ? { seat, move, next: out.state } : null;
}
