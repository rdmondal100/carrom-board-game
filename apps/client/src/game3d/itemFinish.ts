import type { CosmeticItem } from '@carrom/protocol';
import { cardBackSkin, tableSkin } from '@/games/callbreak/skins';
import { boardFinish, pieceFinish } from '@/games/carrom/skins';
import { boardSkin, tokenSkin } from '@/games/ludo/skins';
import { boatSkin } from '@/games/nodipar/skins';
import { isShowcase, type Finish } from './finish';

/** T3D-8 the 3D finish an item shows off (undefined: a look without a special 3D surface). */
export function itemFinish(item: CosmeticItem): Finish | undefined {
  const g = item.game;
  if (g === 'carrom') {
    if (item.type === 'striker' || item.type === 'coins') return pieceFinish(item.id, item.type);
    if (item.type === 'board') return boardFinish(item.id).surface;
  }
  if (g === 'ludo') {
    if (item.type === 'tokens') return tokenSkin(item.id).finish;
    if (item.type === 'board') return boardSkin(item.id).finish;
  }
  if (g === 'callbreak') {
    if (item.type === 'cardBack') return cardBackSkin(item.id).finish;
    if (item.type === 'table') return tableSkin(item.id).rimFinish;
  }
  if (g === 'nodipar' && item.type === 'boat') return boatSkin(item.id).finish;
  return undefined;
}

/** T3D-8 the shop marks this item "3D": its finish shines in the 3D view. */
export const isShowcaseItem = (item: CosmeticItem): boolean => isShowcase(itemFinish(item));
