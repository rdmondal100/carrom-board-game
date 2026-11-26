import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { CanvasTexture } from 'three';
import { LudoBoard } from '@/games/ludo/components/LudoBoard';
import type { BoardSkin, TokenSkin } from '@/games/ludo/skins';
import { canvasTexture, paintGrain, paintMarble } from '@/game3d/three/textures';

/** The 2D board's art spans this many cells (15 + a rim each side). */
export const ART_CELLS = 15.9;
const PX = 1024;
/** Seat 3 viewing = no rotation in the SVG; the 3D board turns instead. */
const UNTURNED_SEAT = 3;

/**
 * T3D-5 the board skin's own SVG art (no tokens) painted on a canvas texture,
 * with the finish's grain or veins laid over it. Starts blank and fills in
 * when the image loads (`onReady`).
 */
export function boardArt(seats: readonly number[], board: BoardSkin, tokens: TokenSkin, onReady: () => void): CanvasTexture {
  const tex = canvasTexture(PX, (ctx, s) => { ctx.fillStyle = board.bg; ctx.fillRect(0, 0, s, s); });
  const svg = renderToStaticMarkup(createElement(LudoBoard, {
    seats, tokens: [], board, tokenSkinOf: () => tokens, viewSeat: UNTURNED_SEAT, turnSeat: null, legal: [],
  })).replace('<svg', `<svg xmlns="http://www.w3.org/2000/svg" width="${PX}" height="${PX}"`);
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
  const img = new Image();
  img.onload = () => {
    const canvas = tex.image as HTMLCanvasElement;
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    // The finish shows through the paint: veins on marble, grain on wood.
    if (board.finish === 'marble' || board.finish === 'wood') {
      const layer = document.createElement('canvas');
      layer.width = layer.height = canvas.width;
      const l = layer.getContext('2d')!;
      if (board.finish === 'marble') paintMarble(l, layer.width, 0xffffff, 0xc9a227, 5);
      else paintGrain(l, layer.width, 0xffffff, 3);
      ctx.globalCompositeOperation = 'multiply';
      ctx.globalAlpha = board.finish === 'marble' ? 0.55 : 0.35;
      ctx.drawImage(layer, 0, 0);
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 1;
    }
    tex.needsUpdate = true;
    URL.revokeObjectURL(url);
    onReady();
  };
  img.onerror = () => URL.revokeObjectURL(url);
  img.src = url;
  return tex;
}
