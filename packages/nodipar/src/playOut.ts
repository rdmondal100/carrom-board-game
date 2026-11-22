// Test helper: plays a seeded match to its end with bots. Not exported from the package.
import type { BotLevel } from '@hub/game-kit';
import { nodiParModule as m } from './module';
import type { NodiConfig, NodiState } from './types';

const MAX_TURNS = 400;

/** Play a match to its end, `levels` per seat (default medium); returns every state. */
export function playOut(config: NodiConfig, seed: number, levels: Record<number, BotLevel>): NodiState[] {
  const states = [m.newGame(config, seed)];
  for (let i = 0; i < MAX_TURNS && !m.result(states.at(-1)!); i++) {
    const s = states.at(-1)!;
    const seat = m.turnSeat(s);
    const out = m.applyMove(s, seat, m.turnId(s), m.bot(s, seat, levels[seat] ?? 'medium', seed * 7919 + i));
    if (!out.ok) throw new Error(out.message);
    states.push(out.state);
  }
  return states;
}
