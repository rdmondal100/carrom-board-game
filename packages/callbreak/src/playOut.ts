import type { BotLevel } from '@hub/game-kit';
import { callbreakModule } from './module';
import type { CallbreakConfig, CallbreakState } from './types';

/** Test helper: play a whole game with a bot level per seat; every move goes through applyMove. */
export function playOut(config: CallbreakConfig, seed: number, levels: readonly BotLevel[]): CallbreakState {
  let s = callbreakModule.newGame(config, seed);
  let n = 0;
  while (s.winner === null) {
    const seat = s.turnSeat;
    const move = callbreakModule.bot(s, seat, levels[seat]!, seed * 1000 + n++);
    const out = callbreakModule.applyMove(s, seat, s.turnId, move);
    if (!out.ok) throw new Error(`bot move refused: ${out.message}`);
    s = out.state;
  }
  return s;
}
