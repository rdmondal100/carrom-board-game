import { useEffect } from 'react';
import { Card, CardTitle } from '@/components/ui/card';
import { t } from '@/i18n/t';
import { cn } from '@/lib/utils';
import { fetchMyMatches, myView } from '@/store/rankedSlice';
import { useAppDispatch, useAppSelector } from '@/store/store';

/** RANK-8 / HAPP-6: my recent online games of one game on the Profile page. */
export function MatchHistory({ userId, game }: { userId: string; game: string }) {
  const dispatch = useAppDispatch();
  const { list, loading, error } = useAppSelector((s) => s.ranked.matches);
  useEffect(() => { void dispatch(fetchMyMatches(game)); }, [dispatch, userId, game]);

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
