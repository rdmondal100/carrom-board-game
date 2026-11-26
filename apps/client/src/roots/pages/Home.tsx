import { BookOpen, ExternalLink, Play, Settings } from 'lucide-react';
import { Link } from 'react-router';
import { GameArt, themeOf } from '@/components/GameArt';
import { AddaStrip, ContinueCard, DailyBonus, GameCard, Hero, WhyUs } from '@/components/HubParts';
import { TodayPanel } from '@/components/ProgressParts';
import { Button } from '@/components/ui/button';
import { DEFAULT_HUB_URL } from '@/constants/brand';
import { useAppName } from '@/games/appName';
import { useGames } from '@/games/GamesContext';
import { ALL_GAMES } from '@/games/registry';
import { gamePath, type ClientGame } from '@/games/types';
import { t, useLang } from '@/i18n/t';
import { useAppSelector } from '@/store/store';

/** Where "more games" points (the web hub). */
const HUB_URL = ((import.meta.env.VITE_HUB_URL as string | undefined) ?? '').trim().replace(/\/+$/, '') || DEFAULT_HUB_URL;

function SectionTitle({ children }: { children: string }) {
  return (
    <h2 className="flex items-center gap-2 text-xl font-extrabold">
      <span className="h-5 w-1.5 rounded-full bg-linear-to-b from-amber-300 to-orange-500" />{children}
    </h2>
  );
}

/**
 * HAPP-2 the web / hub-app home: hero, saved games to continue, PRG-8 today's level, streak and
 * missions (signed in), game posters, the sign-in bonus card (signed out), adda.
 */
function HubHome({ games }: { games: readonly ClientGame[] }) {
  const name = useAppName();
  const signedIn = useAppSelector((s) => s.auth.user !== null);
  const saved = games.filter((g) => g.routes.localGame && g.hasSave?.());
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-5">
      <Hero games={games} title={name} />
      {saved.length > 0 && (
        <div className="grid gap-2 sm:grid-cols-2">{saved.map((g) => <ContinueCard key={g.id} game={g} />)}</div>
      )}
      {signedIn && <TodayPanel />}
      <SectionTitle>{t('hub.games')}</SectionTitle>
      <div className="grid grid-cols-2 gap-3 sm:gap-4" data-testid="hub-games">
        {games.map((g, i) => <GameCard key={g.id} game={g} index={i} />)}
      </div>
      {!signedIn && <DailyBonus />}
      <AddaStrip />
      <WhyUs />
    </div>
  );
}

/** HAPP-3 a one-game app: links to the other games on the web hub. */
function MoreGames({ game }: { game: ClientGame }) {
  const others = ALL_GAMES.filter((g) => g.id !== game.id);
  return (
    <div className="flex w-full flex-col gap-3 border-t border-white/10 pt-4" data-testid="more-games">
      <p className="text-sm font-semibold">{t('hub.moreGames')}</p>
      <div className="flex flex-wrap justify-center gap-2">
        {others.map((g) => (
          <a key={g.id} href={`${HUB_URL}${gamePath(g.id)}`} target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-1.5 rounded-full py-1 pr-3 pl-1 text-sm font-medium text-white shadow ring-1 ring-white/15 transition hover:brightness-110"
            style={{ background: themeOf(g.id).poster }}>
            <GameArt id={g.id} className="size-7" />{t(g.nameKey)}
          </a>
        ))}
        <a href={HUB_URL} target="_blank" rel="noopener noreferrer"
          className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm underline">
          {t('hub.openHub')}<ExternalLink className="size-3.5" />
        </a>
      </div>
    </div>
  );
}

/** HAPP-3 a game's own home (the start screen of its app). */
export function GameHome({ game }: { game: ClientGame }) {
  const name = useAppName();
  const saved = Boolean(game.routes.localGame && game.hasSave?.());
  const theme = themeOf(game.id);
  return (
    <div className="mx-auto flex w-full max-w-sm flex-1 flex-col items-center justify-center gap-6 text-center" data-testid="game-home">
      <div className="relative grid size-52 place-items-center animate-pop">
        <div className="absolute inset-4 rounded-full blur-3xl" style={{ background: theme.glow, opacity: 0.45 }} />
        <div className="absolute inset-6 rounded-[2.5rem] rotate-6 ring-1 ring-white/20" style={{ background: theme.poster }} />
        <GameArt id={game.id} className="relative w-44 animate-float" />
      </div>
      <div className="flex flex-col gap-1">
        <h2 className="text-4xl font-extrabold">{name}</h2>
        <p className="text-muted-foreground">{t(game.taglineKey)}</p>
      </div>
      <div className="flex w-full flex-col gap-3">
        {saved && (
          <Button asChild size="lg" variant="secondary">
            <Link to={gamePath(game.id, 'local/play')}>{t('home.resume')}</Link>
          </Button>
        )}
        <Button asChild size="lg" className="relative overflow-hidden text-lg">
          <Link to={gamePath(game.id)}><Play className="fill-current" />{t('home.play')}<span className="shine-sweep" /></Link>
        </Button>
        <div className="grid grid-cols-2 gap-3">
          {game.routes.howToPlay && (
            <Button asChild variant="outline">
              <Link to={gamePath(game.id, 'how-to-play')}><BookOpen />{t('nav.howTo')}</Link>
            </Button>
          )}
          <Button asChild variant="outline">
            <Link to="/settings"><Settings />{t('nav.settings')}</Link>
          </Button>
        </div>
      </div>
      {/* PRG-8 a one-game app shows today's missions (one may be swapped away if it names another game). */}
      <TodayPanel compact />
      <MoreGames game={game} />
    </div>
  );
}

/** UI-1 / HAPP-2 / HAPP-3: `/` = the hub, or the game's home in a one-game build. */
export function Home() {
  useLang();
  const { games, single } = useGames();
  return single ? <GameHome game={single} /> : <HubHome games={games} />;
}
