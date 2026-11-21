import type { RatingChange, ServerMessage } from '@carrom/protocol';
import { teamOf } from '@carrom/rules';
import { useGameEndAds } from '@/components/AdParts';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { t } from '@/i18n/t';
import { formatDelta } from '@/store/rankedSlice';

type RankedResult = Extract<ServerMessage, { type: 'rankedResult' }>;

const stay = (e: Event) => e.preventDefault();

/** RANK-8: the headline for my side of a ranked result. */
export function resultTitleKey(r: RankedResult, mine: RatingChange | undefined): string {
  const won = mine !== undefined && teamOf(mine.seat, '1v1') === r.winner;
  if (r.abandoned) return won ? 'ranked.abandonWin' : 'ranked.abandonLoss';
  return won ? 'ranked.win' : 'ranked.loss';
}

interface ResultProps {
  /** null while the server is still saving it. */
  result: RankedResult | null;
  userId: string | null;
  onAgain: () => void;
  onHome: () => void;
}

/** RANK-8: ranked game over: win or loss and the rating change. */
export function RankedResultScreen({ result, userId, onAgain, onHome }: ResultProps) {
  const { leaving, leave } = useGameEndAds();
  const mine = result?.players.find((p) => p.userId === userId);
  return (
    <Dialog open>
      <DialogContent className="p-6 text-center" onEscapeKeyDown={stay} onPointerDownOutside={stay}>
        <DialogHeader>
          <DialogTitle className="text-xl">{t('gameEnd.title')}</DialogTitle>
          <DialogDescription className="text-2xl font-semibold text-amber-300">
            {result ? t(resultTitleKey(result, mine)) : t('ranked.saving')}
          </DialogDescription>
        </DialogHeader>
        {mine && (
          <p className="text-lg tabular-nums" data-testid="rating-change">
            {t('ranked.ratingChange', {
              before: mine.ratingBefore, after: mine.ratingAfter, delta: formatDelta(mine.ratingBefore, mine.ratingAfter),
            })}
          </p>
        )}
        <DialogFooter className="mt-2 flex-row justify-center">
          <Button autoFocus onClick={() => leave(onAgain)} disabled={!result || leaving}>{t('ranked.again')}</Button>
          <Button variant="outline" onClick={() => leave(onHome)} disabled={leaving}>{t('gameEnd.home')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
