import { CanvasTexture, RepeatWrapping, SRGBColorSpace } from 'three';
import { rng } from '../rng';

/** T3D-9 textures stay at or under this size. */
export const MAX_TEX = 1024;

/** `0xrrggbb` or a CSS colour → CSS colour. */
export const css = (c: number | string): string => (typeof c === 'number' ? `#${c.toString(16).padStart(6, '0')}` : c);

/** Mix a CSS hex colour toward white (k > 0) or black (k < 0). */
export function shade(c: number | string, k: number): string {
  const n = typeof c === 'number' ? c : Number.parseInt(c.replace('#', '').slice(0, 6), 16);
  const ch = (v: number) => Math.round(k >= 0 ? v + (255 - v) * k : v * (1 + k));
  const r = ch((n >> 16) & 255);
  const g = ch((n >> 8) & 255);
  const b = ch(n & 255);
  return `rgb(${r}, ${g}, ${b})`;
}

export { rng };

/** A canvas texture of `size` px drawn by `draw`. */
export function canvasTexture(size: number, draw: (ctx: CanvasRenderingContext2D, size: number) => void, repeat = false): CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = Math.min(size, MAX_TEX);
  const ctx = canvas.getContext('2d')!;
  draw(ctx, canvas.width);
  const tex = new CanvasTexture(canvas);
  tex.colorSpace = SRGBColorSpace;
  tex.anisotropy = 4;
  if (repeat) tex.wrapS = tex.wrapT = RepeatWrapping;
  return tex;
}

/** Wood grain over the whole square (base colour, darker wavy grain lines). */
export function paintGrain(ctx: CanvasRenderingContext2D, size: number, base: number | string, seed = 7): void {
  const r = rng(seed);
  ctx.fillStyle = css(base);
  ctx.fillRect(0, 0, size, size);
  for (let i = 0; i < 90; i++) {
    const y0 = r() * size;
    const amp = 2 + r() * 6;
    const freq = 0.004 + r() * 0.01;
    ctx.strokeStyle = r() > 0.5 ? shade(base, -0.18 - r() * 0.12) : shade(base, 0.08);
    ctx.globalAlpha = 0.18 + r() * 0.25;
    ctx.lineWidth = 0.6 + r() * 2.2;
    ctx.beginPath();
    for (let x = 0; x <= size; x += 8) ctx.lineTo(x, y0 + Math.sin(x * freq + i) * amp);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

/** Marble: a soft base with dark and gold veins wandering across. */
export function paintMarble(ctx: CanvasRenderingContext2D, size: number, base: number | string, vein: number | string, seed = 11): void {
  const r = rng(seed);
  const g = ctx.createRadialGradient(size * 0.4, size * 0.35, size * 0.05, size / 2, size / 2, size * 0.75);
  g.addColorStop(0, shade(base, 0.25));
  g.addColorStop(1, css(base));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  for (let v = 0; v < 14; v++) {
    let x = r() * size;
    let y = r() * size;
    let a = r() * Math.PI * 2;
    ctx.strokeStyle = v % 4 === 0 ? css(vein) : shade(base, -0.35);
    ctx.globalAlpha = 0.12 + r() * 0.3;
    ctx.lineWidth = 0.5 + r() * 2.5;
    ctx.beginPath();
    ctx.moveTo(x, y);
    for (let s = 0; s < 60; s++) {
      a += (r() - 0.5) * 0.7;
      x += Math.cos(a) * size * 0.02;
      y += Math.sin(a) * size * 0.02;
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}
