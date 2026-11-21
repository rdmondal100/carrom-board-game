import type { LucideIcon } from 'lucide-react';
import { Bot, Globe, Trophy, Users } from 'lucide-react';
import { Link } from 'react-router';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useGame } from '@/games/GamesContext';
import { gamePath, modePath, PLAY_MODES, type PlayModeId } from '@/games/types';
import { t, useLang } from '@/i18n/t';
import { cn } from '@/lib/utils';

const ICONS: Record<PlayModeId, LucideIcon> = { local: Users, bot: Bot, online: Globe, ranked: Trophy };

function ModeCard({ id, to }: { id: PlayModeId; to: string | null }) {
  const Icon = ICONS[id];
  const soon = to === null;
  const body = (
    <Card className={cn('flex-row items-center gap-4', soon ? 'opacity-50' : 'transition-colors hover:bg-accent')}>
      <Icon className="size-9 shrink-0 text-amber-400" />
      <CardHeader className="flex-1">
        <CardTitle>{t(`play.${id}`)}</CardTitle>
        <CardDescription>{t(`play.${id}Desc`)}</CardDescription>
      </CardHeader>
      {soon && <span className="rounded-full bg-muted px-2 py-1 text-xs">{t('play.soon')}</span>}
    </Card>
  );
  if (soon) return <div aria-disabled="true" data-testid={`mode-${id}`}>{body}</div>;
  return <Link to={to} data-testid={`mode-${id}`} className="rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring">{body}</Link>;
}

/** UI-1 / BOT-6 / ROOM-11 / RANK-8 / HAPP-1: one game's modes; a mode the game hasn't got yet shows "coming soon". */
export function PlayMenu() {
  useLang();
  const game = useGame();
  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-4">
      <h2 className="flex items-center gap-2 text-xl font-bold">
        <game.Icon className="size-7 text-amber-400" />{t(game.nameKey)} · {t('play.title')}
      </h2>
      {PLAY_MODES.map((m) => <ModeCard key={m} id={m} to={game.playModes[m] ? modePath(game.id, m) : null} />)}
      <div className="flex justify-center gap-4 text-sm text-muted-foreground">
        {game.playModes.ranked && (
          <Link to={gamePath(game.id, 'leaderboard')} className="underline" data-testid="leaderboard-link">{t('play.leaderboard')}</Link>
        )}
        {game.routes.howToPlay && <Link to={gamePath(game.id, 'how-to-play')} className="underline">{t('nav.howTo')}</Link>}
      </div>
    </div>
  );
}
