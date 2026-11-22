// NODI-3: the game-neutral part of the shot search, shared by carrom and Nodi Par.
// Carrom's behaviour is unchanged: chooseShot calls these with its own numbers.
import { config as engine, type Piece, type Vec } from '@carrom/engine';
import { BOT } from './config';

/** Any aimed flick: a unit direction and a power. */
export interface Aim {
  dirX: number;
  dirY: number;
  power: number;
}

/** What the search needs from a bot level. */
export interface SearchLevel {
  sims: number;
  aimNoiseSin: number;
  powerNoise: number;
}

export interface PowerRange {
  min: number;
  max: number;
}

const ENGINE_POWER: PowerRange = { min: engine.MIN_POWER, max: engine.MAX_POWER };

/**
 * Turn the aim by the angle whose sine is `s` (cos = √(1 − s²), no trig)
 * and scale the power by (1 + dp), clamped to `range`.
 */
export function nudge<T extends Aim>(input: T, s: number, dp: number, range: PowerRange = ENGINE_POWER): T {
  const c = Math.sqrt(1 - s * s);
  const dirX = input.dirX * c - input.dirY * s;
  const dirY = input.dirX * s + input.dirY * c;
  const len = Math.sqrt(dirX * dirX + dirY * dirY);
  const power = input.power * (1 + dp);
  return {
    ...input,
    dirX: dirX / len,
    dirY: dirY / len,
    power: Math.min(range.max, Math.max(range.min, power)),
  };
}

/** Uniform in [-1, 1). */
const signed = (rand: () => number): number => 2 * rand() - 1;

/** BOT-4: aim and power noise, applied after choosing, from the seeded PRNG. */
export function addNoise<T extends Aim>(input: T, level: SearchLevel, rand: () => number, range: PowerRange = ENGINE_POWER): T {
  const s = signed(rand) * level.aimNoiseSin;
  return nudge(input, s, signed(rand) * level.powerNoise, range);
}

export const ROBUST_TRIES = 4;

/** How many of the best candidates get the near-miss re-run, for a level's budget. */
export function robustTop(sims: number): number {
  return Math.min(BOT.ROBUST_TOP, Math.floor(sims / (2 * (ROBUST_TRIES + 1))));
}

/**
 * BOT-3/4: score every candidate, re-run the best `top` slightly off (aim ±,
 * power ±) and keep the one with the best average. null when every candidate
 * is refused (-Infinity).
 */
export function bestRobust<T extends Aim>(
  cands: readonly { input: T; rank: number }[],
  evaluate: (input: T) => number,
  level: SearchLevel,
  top: number,
  range: PowerRange = ENGINE_POWER,
): T | null {
  const scored = cands
    .map((c) => ({ input: c.input, score: evaluate(c.input), rank: c.rank }))
    .filter((c) => c.score > -Infinity)
    .sort((a, b) => b.score + BOT.CLEAN_AIM * b.rank - (a.score + BOT.CLEAN_AIM * a.rank));

  const s = Math.max(level.aimNoiseSin, BOT.ROBUST_MIN_SIN);
  const p = Math.max(level.powerNoise, BOT.ROBUST_MIN_POWER);
  let best: T | null = null;
  let bestScore = -Infinity;
  for (const c of scored.slice(0, Math.max(1, top))) {
    let score = c.score;
    if (top > 0) {
      const tries = [nudge(c.input, s, 0, range), nudge(c.input, -s, 0, range), nudge(c.input, 0, p, range), nudge(c.input, 0, -p, range)];
      let sum = c.score;
      for (const t of tries) sum += evaluate(t);
      score = sum / (tries.length + 1);
    }
    if (score > bestScore) {
      bestScore = score;
      best = c.input;
    }
  }
  return best;
}

/** Distance² from point p to segment a→b. */
export function segDist2(p: Vec, a: Vec, b: Vec): number {
  const abx = b.x - a.x;
  const aby = b.y - a.y;
  const len2 = abx * abx + aby * aby;
  let t = len2 === 0 ? 0 : ((p.x - a.x) * abx + (p.y - a.y) * aby) / len2;
  t = Math.min(1, Math.max(0, t));
  const dx = a.x + abx * t - p.x;
  const dy = a.y + aby * t - p.y;
  return dx * dx + dy * dy;
}

/** How many discs (pieces, rocks) sit in the way of a disc of radius r sliding a→b. */
export function blockers(a: Vec, b: Vec, r: number, others: readonly (Vec & { r: number })[]): number {
  let n = 0;
  for (const o of others) {
    const reach = r + o.r;
    if (segDist2(o, a, b) < reach * reach) n++;
  }
  return n;
}

/**
 * Ghost-ball aim: where a shooter of radius `shooterR` must touch `target`
 * so it heads to `goal`. `u` is the target's unit path, `dist` its length.
 */
export function ghostPoint(
  target: Pick<Piece, 'x' | 'y' | 'r'>, goal: Vec, shooterR: number,
): { ghost: Vec; u: Vec; dist: number } | null {
  const cpx = goal.x - target.x;
  const cpy = goal.y - target.y;
  const dist = Math.sqrt(cpx * cpx + cpy * cpy);
  if (dist === 0) return null;
  const u = { x: cpx / dist, y: cpy / dist };
  const ghost = { x: target.x - u.x * (target.r + shooterR), y: target.y - u.y * (target.r + shooterR) };
  return { ghost, u, dist };
}
