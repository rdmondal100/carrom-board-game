/**
 * HUB-2: the one random source games may use. mulberry32: a 32-bit state that
 * lives in the game state, so the same seed always gives the same game.
 */
export interface Rng { seed: number }

/** One draw in [0, 1) and the next state. */
export function nextFloat(rng: Rng): [number, Rng] {
  const s = (rng.seed + 0x6d2b79f5) >>> 0;
  let t = s;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return [((t ^ (t >>> 14)) >>> 0) / 4294967296, { seed: s }];
}

/** A whole number in [0, n). */
export function nextInt(rng: Rng, n: number): [number, Rng] {
  const [u, next] = nextFloat(rng);
  return [Math.floor(u * n), next];
}

/** Fisher–Yates with the seeded source; returns the shuffled copy and the next state. */
export function shuffle<T>(items: readonly T[], rng: Rng): [T[], Rng] {
  const out = [...items];
  let r = rng;
  for (let i = out.length - 1; i > 0; i--) {
    let j: number;
    [j, r] = nextInt(r, i + 1);
    [out[i], out[j]] = [out[j] as T, out[i] as T];
  }
  return [out, r];
}
