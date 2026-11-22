import { placeStriker, simulateShot, type Seat, type ShotInput } from '@carrom/engine';
import { applyShot, type GameState } from '@carrom/rules';
import { candidates } from './candidates';
import { LEVELS, type BotLevel } from './config';
import { mulberry32 } from './random';
import { scoreShot } from './score';
import { addNoise, bestRobust, nudge, robustTop, ROBUST_TRIES } from './search';

export { addNoise, nudge };

/** Simulate one candidate and score it; -Infinity when the engine refuses it. */
export function evaluate(g: GameState, input: ShotInput): number {
  try {
    const shot = simulateShot(g.board, input);
    const out = applyShot(g, shot.events, shot.final);
    return scoreShot(g, out.state, out.events);
  } catch (e) {
    if (e instanceof RangeError) return -Infinity;
    throw e;
  }
}

/** Straight up the board from the first free baseline spot (no candidate found). */
function fallback(g: GameState): ShotInput {
  const seat = g.turnSeat as Seat;
  const spot = placeStriker(g.board, seat, 0);
  return { seat, x: spot.x, dirX: 0, dirY: 1, power: 0.5 };
}

/**
 * Pick a shot for the seat to move (BOT-1..4). Pure and deterministic:
 * same state, level and seed → same shot.
 */
export function chooseShot(g: GameState, level: BotLevel, seed: number): ShotInput {
  if (g.winner !== null) throw new Error('The game is over');
  const cfg = LEVELS[level];
  const rand = mulberry32(seed);
  const top = robustTop(cfg.sims);
  const best = bestRobust(candidates(g, cfg, cfg.sims - top * ROBUST_TRIES), (i) => evaluate(g, i), cfg, top);
  return addNoise(best ?? fallback(g), cfg, rand);
}
