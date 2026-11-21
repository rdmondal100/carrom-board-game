import type { CosmeticPreviewProps } from '@/games/types';
import { cbLook } from '@/games/callbreak/skins';
import { cn } from '@/lib/utils';
import { CardBack, CardFace } from './PlayingCard';

/** CB-9 the shop's preview of a card back on a table: a picture only. */
export function CbPreview({ equipped, className }: CosmeticPreviewProps) {
  const look = cbLook({ cardBack: equipped.cardBack ?? '', table: equipped.table ?? '' });
  return (
    <div className={cn('flex aspect-[4/3] items-center justify-center gap-1 rounded-xl border-4 p-2', className)}
      style={{ background: look.table.felt, borderColor: look.table.rim }} data-testid="cb-preview">
      <CardBack skin={look.back} size="sm" className="-rotate-12" />
      <CardBack skin={look.back} size="sm" />
      <CardFace card="AS" size="sm" className="rotate-12" />
    </div>
  );
}
