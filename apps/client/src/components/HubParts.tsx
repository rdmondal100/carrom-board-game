import { Bot, ChevronRight, Gift, Globe, Languages, Link2, Mic, Play, ShieldCheck, Sparkles, Trophy, Users, type LucideIcon } from 'lucide-react';
import { Link } from 'react-router';
import { Button } from '@/components/ui/button';
import { GameArt, themeOf } from '@/components/GameArt';
import { gamePath, isPlayable, PLAY_MODES, type ClientGame, type PlayModeId } from '@/games/types';
import { t } from '@/i18n/t';
import { cn } from '@/lib/utils';
import { useAppSelector } from '@/store/store';

export const MODE_ICONS: Record<PlayModeId, LucideIcon> = { local: Users, bot: Bot, online: Globe, ranked: Trophy };

const MS_PER_DAY = 86_400_000;

/** Greeting for the time of day. */
export function greetingKey(hour: number): string {
  if (hour >= 5 && hour < 12) return 'hub.greet.morning';
  if (hour >= 12 && hour < 17) return 'hub.greet.afternoon';
  if (hour >= 17 && hour < 21) return 'hub.greet.evening';
  return 'hub.greet.night';
}

/** Today's pick: a different playable game each day. */
export function pickOfDay(games: readonly ClientGame[], now = Date.now()): ClientGame | null {
  const playable = games.filter(isPlayable);
  if (playable.length === 0) return null;
  return playable[Math.floor(now / MS_PER_DAY) % playable.length]!;
}

/** The hub's opening banner: greeting, today's pick and the big play button. */
export function Hero({ games, title }: { games: readonly ClientGame[]; title: string }) {
  const user = useAppSelector((s) => s.auth.user);
  const pick = pickOfDay(games);
  const name = user?.name?.split(' ')[0];
  return (
    <section className="relative isolate overflow-hidden rounded-3xl border border-white/10 bg-linear-to-br from-fuchsia-600 via-violet-700 to-indigo-900 p-5 shadow-2xl shadow-fuchsia-900/30 animate-pop sm:p-7">
      <div className="nakshi absolute inset-0 -z-10 opacity-60" />
      <div className="absolute -top-16 -right-10 -z-10 size-56 rounded-full bg-amber-400/30 blur-3xl" />
      {pick && <GameArt id={pick.id} className="absolute -top-3 -right-8 -z-10 w-32 rotate-12 opacity-90 animate-float-slow sm:top-auto sm:-right-4 sm:-bottom-6 sm:w-52 sm:rotate-6" />}
      <p className="flex items-center gap-1.5 text-sm font-semibold text-amber-200">
        <Sparkles className="size-4" />{t(greetingKey(new Date().getHours()))}{name ? `, ${name}` : ''}
      </p>
      <h2 className="mt-1 max-w-[12ch] sm:max-w-[16ch] text-3xl leading-tight font-extrabold sm:text-4xl">{t('hub.heroTitle', { app: title })}</h2>
      <p className="mt-2 max-w-[30ch] text-sm text-white/80">{t('hub.tagline')}</p>
      {pick && (
        <div className="mt-5 flex flex-wrap items-center gap-2">
          <Button asChild size="lg" className="relative overflow-hidden" data-testid="hero-play">
            <Link to={gamePath(pick.id)}><Play className="fill-current" />{t('hub.playNow', { game: t(pick.nameKey) })}<span className="shine-sweep" /></Link>
          </Button>
          <Button asChild size="lg" variant="outline" className="border-white/25 bg-white/10">
            <Link to="/groups"><Users />{t('hub.inviteFriends')}</Link>
          </Button>
        </div>
      )}
    </section>
  );
}

/** A saved same-device game to jump back into. */
export function ContinueCard({ game }: { game: ClientGame }) {
  const theme = themeOf(game.id);
  return (
    <Link to={gamePath(game.id, 'local/play')} data-testid={`continue-${game.id}`}
      className="group flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 p-2 pr-4 backdrop-blur transition hover:bg-white/10">
      <span className="grid size-12 shrink-0 place-items-center overflow-hidden rounded-xl" style={{ background: theme.poster }}>
        <GameArt id={game.id} className="w-11" />
      </span>
      <span className="min-w-0 flex-1 text-sm font-semibold">{t('hub.continue', { game: t(game.nameKey) })}</span>
      <span className="grid size-8 place-items-center rounded-full bg-amber-400 text-primary-foreground transition group-hover:scale-110">
        <Play className="size-4 fill-current" />
      </span>
    </Link>
  );
}

/** HAPP-2 one game's poster card on the hub home: opens the game, or "coming soon". */
export function GameCard({ game, index }: { game: ClientGame; index: number }) {
  const soon = !isPlayable(game);
  const theme = themeOf(game.id);
  const modes = PLAY_MODES.filter((m) => game.playModes[m]);
  const body = (
    <div className={cn('relative isolate flex h-full min-h-48 flex-col overflow-hidden rounded-3xl p-4 text-white shadow-xl ring-1 ring-white/15 transition duration-300',
      soon ? 'opacity-50 grayscale' : 'group-hover:-translate-y-1 group-hover:shadow-2xl')}
      style={{ background: theme.poster, boxShadow: soon ? undefined : `0 18px 40px -18px ${theme.glow}` }}>
      <div className="nakshi absolute inset-0 -z-10 opacity-40" />
      <div className="absolute inset-x-0 top-0 -z-10 h-1/2 bg-linear-to-b from-white/20 to-transparent" />
      <GameArt id={game.id} className="absolute -top-2 -right-3 -z-10 w-32 transition duration-500 group-hover:scale-110 group-hover:rotate-6 sm:w-36" />
      {theme.badgeKey && !soon && (
        <span className="w-fit rounded-full bg-black/30 px-2 py-0.5 text-[10px] font-bold tracking-wider uppercase backdrop-blur">{t(theme.badgeKey)}</span>
      )}
      <div className="mt-auto flex flex-col gap-1 pt-16">
        <h3 className="text-2xl leading-none font-extrabold drop-shadow">{t(game.nameKey)}</h3>
        <p className="line-clamp-2 text-xs text-white/85">{t(game.taglineKey)}</p>
        <div className="mt-2 flex items-center gap-1.5">
          {modes.map((m) => {
            const Icon = MODE_ICONS[m];
            return <span key={m} title={t(`play.${m}`)} className="grid size-6 place-items-center rounded-full bg-black/25"><Icon className="size-3.5" /></span>;
          })}
          {soon ? <span className="ml-auto rounded-full bg-black/40 px-2 py-1 text-xs">{t('play.soon')}</span> : (
            <span className="ml-auto grid size-9 place-items-center rounded-full bg-white text-slate-900 shadow-lg transition group-hover:scale-110">
              <Play className="size-4 fill-current" />
            </span>
          )}
        </div>
      </div>
    </div>
  );
  const style = { animationDelay: `${index * 70}ms` };
  if (soon) return <div aria-disabled="true" data-testid={`game-${game.id}`} className="animate-pop" style={style}>{body}</div>;
  return (
    <Link to={gamePath(game.id)} data-testid={`game-${game.id}`} style={style}
      className="group animate-pop rounded-3xl outline-none focus-visible:ring-4 focus-visible:ring-ring">
      {body}
    </Link>
  );
}

/** HAPP-2 COS-2: coins and the daily bonus (the Header claims it once a day). */
export function DailyBonus() {
  const user = useAppSelector((s) => s.auth.user);
  return (
    <div className="relative flex items-center gap-4 overflow-hidden rounded-3xl border border-amber-300/30 bg-linear-to-r from-amber-500/25 via-orange-500/15 to-transparent p-4" data-testid="daily-bonus">
      <span className="grid size-14 shrink-0 place-items-center rounded-2xl bg-linear-to-b from-amber-300 to-orange-500 text-primary-foreground shadow-[0_4px_0_#b45309] animate-float">
        <Gift className="size-7" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-display text-lg leading-tight font-bold text-amber-100">{t('hub.bonusTitle')}</p>
        <p className="text-sm text-white/75">{user ? t('hub.bonus', { coins: user.coins }) : t('hub.bonusSignIn')}</p>
      </div>
      {user ? (
        <Button asChild size="sm" variant="outline"><Link to="/shop">{t('nav.shop')}</Link></Button>
      ) : (
        <Button asChild size="sm"><Link to="/login">{t('nav.login')}</Link></Button>
      )}
    </div>
  );
}

const AVATAR_TINTS = ['#f472b6', '#facc15', '#34d399', '#60a5fa'];

/** ADDA-2 the invite-your-friends strip. */
export function AddaStrip() {
  return (
    <Link to="/groups" className="group relative flex items-center gap-4 overflow-hidden rounded-3xl border border-white/10 bg-linear-to-r from-teal-500/25 via-sky-500/10 to-transparent p-4 transition hover:border-teal-300/40">
      <div className="flex -space-x-3">
        {AVATAR_TINTS.map((c, i) => (
          <span key={c} className="grid size-10 place-items-center rounded-full border-2 border-background text-sm font-bold text-slate-900" style={{ background: c, zIndex: 4 - i }}>
            {['র', 'স', 'ত', '+'][i]}
          </span>
        ))}
      </div>
      <div className="min-w-0 flex-1">
        <p className="font-display text-lg leading-tight font-bold">{t('hub.addaTitle')}</p>
        <p className="text-sm text-white/75">{t('hub.addaDesc')}</p>
      </div>
      <ChevronRight className="size-6 shrink-0 transition group-hover:translate-x-1" />
    </Link>
  );
}

const WHY: readonly { Icon: LucideIcon; key: string; tint: string }[] = [
  { Icon: ShieldCheck, key: 'hub.why.fair', tint: 'text-emerald-300' },
  { Icon: Link2, key: 'hub.why.link', tint: 'text-sky-300' },
  { Icon: Mic, key: 'hub.why.voice', tint: 'text-pink-300' },
  { Icon: Languages, key: 'hub.why.bangla', tint: 'text-amber-300' },
];

/** Why play here (the positioning from STATUS.md, in a line each). */
export function WhyUs() {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {WHY.map(({ Icon, key, tint }) => (
        <div key={key} className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] p-3 text-xs font-medium">
          <Icon className={cn('size-5 shrink-0', tint)} />{t(key)}
        </div>
      ))}
    </div>
  );
}
