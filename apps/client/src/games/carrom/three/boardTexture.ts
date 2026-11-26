import type { CanvasTexture } from 'three';
import type { BoardPalette, BoardFinish } from '@/games/carrom/skins';
import { canvasTexture, paintMarble } from '@/game3d/three/textures';
import { paintSurface, type Ground } from '../boardArt';

const PX = 1024;

/**
 * T3D-4 the playing surface as a texture: the same painted board as 2D (the board
 * is the same from every side, so it is painted once), over wood grain or marble
 * when the board's finish has one. The pockets are real holes in the 3D mesh.
 */
export function boardTexture(C: BoardPalette, finish: BoardFinish): CanvasTexture {
  return canvasTexture(PX, (ctx, s) => {
    const ground: Ground = finish.surface === 'marble'
      ? (c, size) => paintMarble(c, size, C.surface, C.accent, 21)
      : finish.surface === 'wood' ? 'wood' : 'plain';
    paintSurface(ctx, s, C, ground);
  });
}
