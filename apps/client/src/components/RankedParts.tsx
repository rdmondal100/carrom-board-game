import { useEffect } from 'react';
import type { RatingChange, ServerMessage } from '@carrom/protocol';
import { teamOf } from '@carrom/rules';
import { Button } from '@/components/ui/button';
import { Card, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { t } from '@/i18n/t';
import { cn } from '@/lib/utils';
import { fetchMyMatches, formatDelta, myView } from '@/store/rankedSlice';
import { useAppDispatch, useAppSelector } from '@/store/store';

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
          <Button autoFocus onClick={onAgain} disabled={!result}>{t('ranked.again')}</Button>
          <Button variant="outline" onClick={onHome}>{t('gameEnd.home')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** RANK-8: my recent online games on the Profile page. */
export function MatchHistory({ userId }: { userId: string }) {
  const dispatch = useAppDispatch();
  const { list, loading, error } = useAppSelector((s) => s.ranked.matches);
  useEffect(() => { void dispatch(fetchMyMatches()); }, [dispatch, userId]);

  return (
    <Card className="gap-2">
      <CardTitle>{t('history.title')}</CardTitle>
      {error && <p role="alert" className="text-sm text-destructive">{t('online.err.network')}</p>}
      {loading && list.length === 0 && <p className="text-sm text-muted-foreground">{t('auth.loading')}</p>}
      {!loading && !error && list.length === 0 && <p className="text-sm text-muted-foreground">{t('history.empty')}</p>}
      <ul className="flex flex-col gap-1">
        {list.map((m) => {
          const v = myView(m, userId);
          if (!v) return null;
          return (
            <li key={m.id} className="flex items-center gap-3 rounded-md bg-muted/50 px-3 py-2 text-sm" data-testid="history-row">
              <span className={cn('w-12 font-semibold', v.won ? 'text-emerald-400' : 'text-red-400')}>
                {v.won ? t('history.won') : t('history.lost')}
              </span>
              <span className="min-w-0 flex-1 truncate">
                {t('history.vs', { names: v.opponents.join(', ') })}
                {m.abandoned && <span className="text-muted-foreground"> · {t('history.left')}</span>}
              </span>
              <span className="tabular-nums">{m.ranked ? v.delta : t('history.unranked')}</span>
              <span className="text-xs text-muted-foreground">{new Date(m.createdAt).toLocaleDateString()}</span>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
