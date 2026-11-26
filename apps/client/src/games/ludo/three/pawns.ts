import { LatheGeometry, OctahedronGeometry, Vector2, type BufferGeometry } from 'three';
import type { TokenShape } from '@/games/ludo/skins';

/** T3D-5 a turned profile (radius, height) in board cells; base at y = 0. */
const PROFILES: Record<Exclude<TokenShape, 'gem'>, readonly [number, number][]> = {
  // A classic pawn: wide foot, waist, collar, round head.
  pawn: [[0, 0], [0.36, 0], [0.38, 0.05], [0.33, 0.1], [0.2, 0.2], [0.13, 0.36], [0.12, 0.47], [0.2, 0.5], [0.12, 0.54],
    [0.17, 0.6], [0.19, 0.68], [0.17, 0.76], [0.1, 0.82], [0, 0.84]],
  // A hurricane lantern: base, glass body, cap, ring.
  lantern: [[0, 0], [0.27, 0], [0.28, 0.05], [0.22, 0.1], [0.27, 0.3], [0.25, 0.48], [0.14, 0.52], [0.2, 0.58], [0.06, 0.66],
    [0.08, 0.72], [0, 0.74]],
  // A water lily: short stem, petals opening wide.
  shapla: [[0, 0], [0.22, 0], [0.12, 0.08], [0.09, 0.22], [0.2, 0.36], [0.36, 0.5], [0.39, 0.56], [0.28, 0.54], [0.16, 0.5], [0, 0.52]],
};

const cache = new Map<TokenShape, BufferGeometry>();

/** T3D-5 the shared geometry of a token shape (made once). */
export function pawnGeometry(shape: TokenShape): BufferGeometry {
  const hit = cache.get(shape);
  if (hit) return hit;
  let g: BufferGeometry;
  if (shape === 'gem') {
    g = new OctahedronGeometry(0.3, 0);
    g.scale(1, 1.35, 1);
    g.translate(0, 0.42, 0);
  } else {
    g = new LatheGeometry(PROFILES[shape].map(([r, y]) => new Vector2(r, y)), 28);
  }
  g.computeVertexNormals();
  cache.set(shape, g);
  return g;
}
