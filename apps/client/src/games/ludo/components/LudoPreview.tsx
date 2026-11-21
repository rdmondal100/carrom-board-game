import { LUDO } from '@hub/ludo';
import type { CosmeticPreviewProps } from '@/games/types';
import { ludoLook } from '@/games/ludo/skins';
import { cn } from '@/lib/utils';
import { Dice } from './Dice';
import { LudoBoard } from './LudoBoard';

/** A picture only: a few tokens out on the track, so a set and a board show together. */
const SAMPLE: number[][] = [[LUDO.YARD, 4, 20, LUDO.HOME], [LUDO.YARD, LUDO.YARD, 9, 30], [0, LUDO.YARD, 47, 52], [LUDO.YARD, 15, LUDO.YARD, LUDO.YARD]];

/** LUDO-8 the shop's preview of a Ludo token set, board theme and die. */
export function LudoPreview({ equipped, className }: CosmeticPreviewProps) {
  const look = ludoLook({ tokens: equipped.tokens ?? '', board: equipped.board ?? '', dice: equipped.dice ?? '' });
  return (
    <div className={cn('relative', className)}>
      <LudoBoard seats={[0, 1, 2, 3]} tokens={SAMPLE} board={look.board} tokenSkinOf={() => look.tokens} viewSeat={3} turnSeat={null} legal={[]} />
      <Dice value={6} skin={look.dice} label="" className="absolute bottom-1 right-1 size-8" />
    </div>
  );
}
