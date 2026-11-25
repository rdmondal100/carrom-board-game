import { BookOpen, ChevronRight, Medal } from 'lucide-react';
import { Link } from 'react-router';
import { GameArt, themeOf } from '@/components/GameArt';
import { MODE_ICONS } from '@/components/HubParts';
import { useGame } from '@/games/GamesContext';
import { gamePath, modePath, PLAY_MODES, type PlayModeId } from '@/games/types';
import { t, useLang } from '@/i18n/t';
import { cn } from '@/lib/utils';

/** Each mode's own colour, so the four choices read at a glance. */
const MODE_TINT: Record<PlayModeId, string> = {
  local: 'from-pink-500 to-rose-600 shadow-rose-900/40',
  bot: 'from-violet-500 to-purple-700 shadow-purple-900/40',
  online: 'from-sky-400 to-blue-600 shadow-blue-900/40',
  ranked: 'from-amber-400 to-orange-600 shadow-orange-900/40',
};

function ModeCard({ id, to, index }: { id: PlayModeId; to: string | null; index: number }) {
  const Icon = MODE_ICONS[id];
  const soon = to === null;
  const body = (
    <div className={cn('relative flex h-full flex-col gap-2 overflow-hidden rounded-3xl bg-linear-to-br p-4 text-white shadow-lg ring-1 ring-white/15 transition',
      MODE_TINT[id], soon ? 'opacity-45 grayscale' : 'group-hover:-translate-y-0.5 group-hover:brightness-110')}>
      <div className="nakshi absolute inset-0 opacity-30" />
      <Icon className="absolute -right-3 -bottom-3 size-24 opacity-15" />
      <span className="relative grid size-11 place-items-center rounded-2xl bg-white/20 backdrop-blur"><Icon className="size-6" /></span>
      <h3 className="relative text-lg leading-tight font-extrabold">{t(`play.${id}`)}</h3>
      <p className="relative text-xs text-white/85">{t(`play.${id}Desc`)}</p>
      {soon && <span className="relative mt-auto w-fit rounded-full bg-black/35 px-2 py-0.5 text-xs">{t('play.soon')}</span>}
    </div>
  );
  const style = { animationDelay: `${index * 60}ms` };
  if (soon) return <div aria-disabled="true" data-testid={`mode-${id}`} className="animate-pop" style={style}>{body}</div>;
  return (
    <Link to={to} data-testid={`mode-${id}`} style={style} className="group animate-pop rounded-3xl outline-none focus-visible:ring-4 focus-visible:ring-ring">
      {body}
    </Link>
  );
}

/** UI-1 / BOT-6 / ROOM-11 / RANK-8 / HAPP-1: one game's modes; a mode the game hasn't got yet shows "coming soon". */
export function PlayMenu() {
  useLang();
  const game = useGame();
  const theme = themeOf(game.id);
  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-4">
      <section className="relative isolate flex min-h-36 items-end overflow-hidden rounded-3xl p-5 text-white shadow-xl ring-1 ring-white/15 animate-pop"
        style={{ background: theme.poster, boxShadow: `0 20px 50px -24px ${theme.glow}` }}>
        <div className="nakshi absolute inset-0 -z-10 opacity-40" />
        <GameArt id={game.id} className="absolute -top-3 -right-2 -z-10 w-36 animate-float-slow sm:w-44" />
        <div className="flex flex-col gap-1">
          <h2 className="flex flex-col leading-none">
            <span className="text-xs font-bold tracking-[0.2em] text-white/80 uppercase">{t('play.title')}</span>{' '}
            <span className="text-4xl font-extrabold drop-shadow">{t(game.nameKey)}</span>
          </h2>
          <p className="max-w-[28ch] text-sm text-white/85">{t(game.taglineKey)}</p>
        </div>
      </section>
      <div className="grid grid-cols-2 gap-3">
        {PLAY_MODES.map((m, i) => <ModeCard key={m} id={m} index={i} to={game.playModes[m] ? modePath(game.id, m) : null} />)}
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        {game.playModes.ranked && (
          <Link to={gamePath(game.id, 'leaderboard')} data-testid="leaderboard-link"
            className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 p-3 text-sm font-semibold transition hover:bg-white/10">
            <Medal className="size-5 text-amber-300" /><span className="flex-1">{t('play.leaderboard')}</span><ChevronRight className="size-4 opacity-60" />
          </Link>
        )}
        {game.routes.howToPlay && (
          <Link to={gamePath(game.id, 'how-to-play')}
            className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 p-3 text-sm font-semibold transition hover:bg-white/10">
            <BookOpen className="size-5 text-sky-300" /><span className="flex-1">{t('nav.howTo')}</span><ChevronRight className="size-4 opacity-60" />
          </Link>
        )}
      </div>
    </div>
  );
}
