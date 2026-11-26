import { rng } from '../rng';

/** A smooth 2D value noise (0..1) from a seed: the base of every generated wood. */
function valueNoise(seed: number): (x: number, y: number) => number {
  const r = rng(seed);
  const perm = new Uint8Array(512);
  const vals = new Float32Array(256);
  for (let i = 0; i < 256; i++) { perm[i] = i; vals[i] = r(); }
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    const t = perm[i]!;
    perm[i] = perm[j]!;
    perm[j] = t;
  }
  for (let i = 0; i < 256; i++) perm[i + 256] = perm[i]!;
  const at = (ix: number, iy: number) => vals[perm[(ix & 255) + perm[iy & 255]!]!]!;
  return (x, y) => {
    const ix = Math.floor(x);
    const iy = Math.floor(y);
    const fx = x - ix;
    const fy = y - iy;
    const sx = fx * fx * (3 - 2 * fx);
    const sy = fy * fy * (3 - 2 * fy);
    const a = at(ix, iy) + (at(ix + 1, iy) - at(ix, iy)) * sx;
    const b = at(ix, iy + 1) + (at(ix + 1, iy + 1) - at(ix, iy + 1)) * sx;
    return a + (b - a) * sy;
  };
}

function fbm(n: (x: number, y: number) => number, x: number, y: number, octaves = 4): number {
  let sum = 0;
  let amp = 0.5;
  let norm = 0;
  for (let o = 0; o < octaves; o++) {
    sum += n(x, y) * amp;
    norm += amp;
    x *= 2.03;
    y *= 2.03;
    amp *= 0.5;
  }
  return sum / norm;
}

export interface WoodOptions {
  /** Growth rings across the square. */
  rings?: number;
  /** How strongly the rings wander. */
  warp?: number;
  /** How dark the grain gets (0..1). */
  contrast?: number;
  /** How visible the fine fibres are (0..1). */
  fibre?: number;
  seed?: number;
}

const rgbOf = (c: number) => [(c >> 16) & 255, (c >> 8) & 255, c & 255] as const;

/**
 * T3D-4 real-looking wood over the whole square: growth rings with darker
 * latewood, fine fibres along the grain, a slow colour drift, and the warm
 * shift dark grain has under lacquer. Grain runs left to right.
 */
export function paintWood(ctx: CanvasRenderingContext2D, size: number, base: number, o: WoodOptions = {}): void {
  const { rings = 9, warp = 1.4, contrast = 0.42, fibre = 0.5, seed = 1 } = o;
  const res = Math.min(size, 512);
  const n = valueNoise(seed);
  const img = ctx.createImageData(res, res);
  const [r0, g0, b0] = rgbOf(base);
  for (let y = 0; y < res; y++) {
    for (let x = 0; x < res; x++) {
      const nx = x / res;
      const ny = y / res;
      const t = ny * rings + fbm(n, nx * 1.6 + 7, ny * 2.4) * warp;
      const band = 0.5 + 0.5 * Math.sin(t * Math.PI * 2);
      const late = band ** 3;
      const fib = fbm(n, nx * 3 + 31, ny * 90, 3);
      const drift = (fbm(n, nx * 1.1 + 53, ny * 1.1 + 11, 3) - 0.5) * 0.14;
      const dark = contrast * (0.68 * late + fibre * 0.32 * fib) - drift;
      const i = (y * res + x) * 4;
      img.data[i] = Math.max(0, Math.min(255, r0 * (1 - dark * 0.82)));
      img.data[i + 1] = Math.max(0, Math.min(255, g0 * (1 - dark)));
      img.data[i + 2] = Math.max(0, Math.min(255, b0 * (1 - dark * 1.2)));
      img.data[i + 3] = 255;
    }
  }
  if (res === size) { ctx.putImageData(img, 0, 0); return; }
  const tmp = document.createElement('canvas');
  tmp.width = tmp.height = res;
  tmp.getContext('2d')!.putImageData(img, 0, 0);
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(tmp, 0, 0, size, size);
}

/** A wooden floor: planks of the same wood, each a little lighter or darker, with seams and joints. */
export function paintPlanks(ctx: CanvasRenderingContext2D, size: number, base: number, seed = 3): void {
  paintWood(ctx, size, base, { rings: 22, warp: 2.2, contrast: 0.5, fibre: 0.7, seed });
  const r = rng(seed + 9);
  const rows = 6;
  const h = size / rows;
  for (let row = 0; row < rows; row++) {
    ctx.fillStyle = r() > 0.5 ? `rgba(255,235,200,${0.04 + r() * 0.05})` : `rgba(0,0,0,${0.05 + r() * 0.08})`;
    ctx.fillRect(0, row * h, size, h);
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(0, row * h, size, Math.max(1, size / 512));
    const joint = (0.2 + r() * 0.6) * size;
    ctx.fillRect(joint, row * h, Math.max(1, size / 512), h);
  }
}
