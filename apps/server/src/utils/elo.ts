import { ELO_K, ELO_SCALE } from './rankedConfig.js';

/** RANK-1: chance that a player rated `ra` beats one rated `rb`. */
export function expectedScore(ra: number, rb: number): number {
  return 1 / (1 + 10 ** ((rb - ra) / ELO_SCALE));
}

/**
 * RANK-1: new ratings after a game, rounded to integers. `score` is the first
 * player's result: 1 win, 0 loss, 0.5 draw.
 */
export function eloUpdate(ra: number, rb: number, score: 0 | 0.5 | 1, k = ELO_K): [number, number] {
  const delta = k * (score - expectedScore(ra, rb));
  return [Math.round(ra + delta), Math.round(rb - delta)];
}
