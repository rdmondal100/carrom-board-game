import { useEffect } from 'react';
import { Trophy } from 'lucide-react';
import type { LeaderboardEntry } from '@carrom/protocol';
import { Avatar } from '@/components/Avatar';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { t, useLang } from '@/i18n/t';
import { cn } from '@/lib/utils';
import { fetchLeaderboard } from '@/store/rankedSlice';
import { useAppDispatch, useAppSelector } from '@/store/store';

function Row({ e, mine }: { e: LeaderboardEntry; mine: boolean }) {
  return (
    <li
      data-testid={`lb-${e.rank}`}
      className={cn('flex items-center gap-3 rounded-lg px-3 py-2', mine ? 'bg-primary/20' : 'odd:bg-muted/50')}
    >
      <span className="w-8 text-right font-bold tabular-nums">{e.rank}</span>
      <Avatar index={e.avatar} name={e.name} size="sm" />
      <span className="min-w-0 flex-1 truncate">
        {e.name}
        {mine && <span className="ml-2 text-xs text-muted-foreground">({t('leaderboard.you')})</span>}
      </span>
      <span className="font-semibold tabular-nums">{e.rating}</span>
    </li>
  );
}

/** RANK-6 / RANK-8: top 100 by rating, and my rank. */
export function Leaderboard() {
  useLang();
  const dispatch = useAppDispatch();
  const { players, me, loading, error } = useAppSelector((s) => s.ranked.leaderboard);
  const user = useAppSelector((s) => s.auth.user);
  useEffect(() => { void dispatch(fetchLeaderboard(undefined)); }, [dispatch, user?.id]);

  const meInList = me !== null && players.some((p) => p.id === me.id);
  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-4">
      <h2 className="flex items-center gap-2 text-xl font-bold"><Trophy className="size-5 text-amber-400" />{t('leaderboard.title')}</h2>
      {error && (
        <div className="flex flex-col gap-2">
          <p role="alert" className="rounded-md bg-destructive/15 px-3 py-2 text-sm text-destructive">{t('online.err.network')}</p>
          <Button variant="outline" onClick={() => void dispatch(fetchLeaderboard(undefined))}>{t('leaderboard.retry')}</Button>
        </div>
      )}
      {loading && players.length === 0 && <p className="text-center text-muted-foreground">{t('auth.loading')}</p>}
      {!loading && !error && players.length === 0 && <p className="text-center text-muted-foreground">{t('leaderboard.empty')}</p>}
      {players.length > 0 && (
        <Card className="p-2">
          <ol className="flex flex-col">
            {players.map((e) => <Row key={e.id} e={e} mine={e.id === me?.id} />)}
          </ol>
        </Card>
      )}
      {me && !meInList && (
        <Card className="gap-1 p-2">
          <p className="px-3 text-xs text-muted-foreground">{t('leaderboard.yourRank')}</p>
          <ol><Row e={me} mine /></ol>
        </Card>
      )}
      {user && !me && !loading && <p className="text-center text-sm text-muted-foreground">{t('leaderboard.notRanked')}</p>}
    </div>
  );
}
