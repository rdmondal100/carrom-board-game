import { useEffect, useState } from 'react';
import { Flag } from 'lucide-react';
import { toast } from 'sonner';
import { REPORT_REASONS, type GroupView, type ReportReason } from '@carrom/protocol';
import { PlayerRow, useGroupGames } from '@/components/AddaParts';
import { Button } from '@/components/ui/button';
import { Card, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { gameIn, useGames } from '@/games/GamesContext';
import { t } from '@/i18n/t';
import { cn } from '@/lib/utils';
import { fetchGroupLeaderboard, reportGroup } from '@/store/addaSlice';
import { useAppDispatch, useAppSelector } from '@/store/store';

/** ADDA-7 report a member (`userId`) or the whole group, with one of the fixed reasons. */
export function ReportButton({ groupId, userId, name }: { groupId: string; userId?: string; name: string }) {
  const dispatch = useAppDispatch();
  const [open, setOpen] = useState(false);
  const send = async (reason: ReportReason) => {
    setOpen(false);
    const r = await dispatch(reportGroup({ id: groupId, reason, ...(userId ? { userId } : {}) }));
    toast(reportGroup.fulfilled.match(r) ? t('voice.reported') : (r.payload?.error ?? t('online.err.network')));
  };
  return (
    <>
      <Button size={userId ? 'icon' : 'sm'} variant="ghost" aria-label={t('adda.report', { name })} onClick={() => setOpen(true)}>
        <Flag className="size-4" />{!userId && t('voice.report')}
      </Button>
      {open && (
        <Dialog open onOpenChange={setOpen}>
          <DialogContent className="max-w-xs p-6">
            <DialogHeader><DialogTitle>{t('voice.reportTitle', { name })}</DialogTitle></DialogHeader>
            <div className="flex flex-col gap-2">
              {REPORT_REASONS.map((r) => <Button key={r} variant="outline" onClick={() => void send(r)}>{t(`voice.reason.${r}`)}</Button>)}
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}

/** ADDA-3 wins inside the group, one game at a time. */
export function GroupLeaderboard({ groupId }: { groupId: string }) {
  const dispatch = useAppDispatch();
  const games = useGroupGames();
  const [picked, setPicked] = useState(games[0]?.id ?? '');
  const board = useAppSelector((s) => s.adda.leaderboard);
  useEffect(() => { if (picked) void dispatch(fetchGroupLeaderboard({ id: groupId, game: picked })); }, [dispatch, groupId, picked]);
  if (games.length === 0) return null;
  const rows = board?.game === picked ? board.rows : [];
  return (
    <Card className="gap-2" data-testid="group-leaderboard">
      <CardTitle>{t('adda.group.leaderboard')}</CardTitle>
      <div role="tablist" className="flex gap-1 overflow-x-auto">
        {games.map((g) => (
          <Button key={g.id} role="tab" size="sm" aria-selected={g.id === picked} variant={g.id === picked ? 'default' : 'outline'} onClick={() => setPicked(g.id)}>
            <g.Icon className="size-4" />{t(g.nameKey)}
          </Button>
        ))}
      </div>
      {rows.length === 0 && <p className="text-sm text-muted-foreground">{t('adda.group.noGames')}</p>}
      <ol className="flex flex-col gap-1">
        {rows.map((r, i) => (
          <PlayerRow key={r.userId} name={r.name} avatar={r.avatar}
            sub={<span className="text-xs text-muted-foreground">{t('adda.group.games', { n: r.games })}</span>}>
            <span className="mr-1 text-xs text-muted-foreground">#{i + 1}</span>
            <span className="font-semibold tabular-nums">{t('adda.group.wins', { n: r.wins })}</span>
          </PlayerRow>
        ))}
      </ol>
    </Card>
  );
}

/** ADDA-3 recent games in the group's rooms: game, winners, when. */
export function GroupMatches({ matches }: { matches: GroupView['matches'] }) {
  const { games } = useGames();
  return (
    <Card className="gap-2">
      <CardTitle>{t('history.title')}</CardTitle>
      {matches.length === 0 && <p className="text-sm text-muted-foreground">{t('adda.group.noGames')}</p>}
      <ul className="flex flex-col gap-1">
        {matches.map((m) => {
          const g = gameIn(games, m.game);
          const winners = m.players.filter((p) => p.team === m.winner).map((p) => p.name);
          return (
            <li key={m.id} className={cn('flex items-center gap-3 rounded-md bg-muted/50 px-3 py-2 text-sm')}>
              <span className="w-20 shrink-0 truncate font-semibold">{g ? t(g.nameKey) : m.game}</span>
              <span className="min-w-0 flex-1 truncate">{t('adda.group.won', { names: winners.join(', ') || '—' })}</span>
              <span className="text-xs text-muted-foreground">{new Date(m.createdAt).toLocaleDateString()}</span>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
