import { config as engine, placeStriker, simulateShot, type Seat, type ShotInput } from '@carrom/engine';
import { applyShot, type GameState } from '@carrom/rules';
import { candidates } from './candidates';
import { BOT, LEVELS, type BotLevel, type LevelConfig } from './config';
import { mulberry32, signed } from './random';
import { scoreShot } from './score';

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

/**
 * Turn the aim by the angle whose sine is `s` (cos = √(1 − s²), no trig)
 * and scale the power by (1 + dp), clamped to the engine's range.
 */
export function nudge(input: ShotInput, s: number, dp: number): ShotInput {
  const c = Math.sqrt(1 - s * s);
  const dirX = input.dirX * c - input.dirY * s;
  const dirY = input.dirX * s + input.dirY * c;
  const len = Math.sqrt(dirX * dirX + dirY * dirY);
  const power = input.power * (1 + dp);
  return {
    ...input,
    dirX: dirX / len,
    dirY: dirY / len,
    power: Math.min(engine.MAX_POWER, Math.max(engine.MIN_POWER, power)),
  };
}

/** BOT-4: aim and power noise, applied after choosing, from the seeded PRNG. */
export function addNoise(input: ShotInput, level: LevelConfig, rand: () => number): ShotInput {
  const s = signed(rand) * level.aimNoiseSin;
  return nudge(input, s, signed(rand) * level.powerNoise);
}

/** Average score of a shot and its near misses (aim ±, power ±). */
function robustScore(g: GameState, input: ShotInput, score: number, level: LevelConfig): number {
  const s = Math.max(level.aimNoiseSin, BOT.ROBUST_MIN_SIN);
  const p = Math.max(level.powerNoise, BOT.ROBUST_MIN_POWER);
  const tries = [nudge(input, s, 0), nudge(input, -s, 0), nudge(input, 0, p), nudge(input, 0, -p)];
  let sum = score;
  for (const t of tries) sum += evaluate(g, t);
  return sum / (tries.length + 1);
}

const ROBUST_TRIES = 4;

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

  const top = Math.min(BOT.ROBUST_TOP, Math.floor(cfg.sims / (2 * (ROBUST_TRIES + 1))));
  const scored = candidates(g, cfg, cfg.sims - top * ROBUST_TRIES)
    .map((c) => ({ input: c.input, score: evaluate(g, c.input), rank: c.rank }))
    .filter((c) => c.score > -Infinity)
    .sort((a, b) => b.score + BOT.CLEAN_AIM * b.rank - (a.score + BOT.CLEAN_AIM * a.rank));

  let best: ShotInput | null = null;
  let bestScore = -Infinity;
  for (const c of scored.slice(0, Math.max(1, top))) {
    const score = top > 0 ? robustScore(g, c.input, c.score, cfg) : c.score;
    if (score > bestScore) {
      bestScore = score;
      best = c.input;
    }
  }
  return addNoise(best ?? fallback(g), cfg, rand);
}
