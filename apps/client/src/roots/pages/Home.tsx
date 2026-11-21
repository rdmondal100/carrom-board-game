import { BookOpen, Coins, ExternalLink, Play, Settings } from 'lucide-react';
import { Link } from 'react-router';
import { Button } from '@/components/ui/button';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { DEFAULT_HUB_URL } from '@/constants/brand';
import { useAppName } from '@/games/appName';
import { useGames } from '@/games/GamesContext';
import { ALL_GAMES } from '@/games/registry';
import { gamePath, isPlayable, type ClientGame } from '@/games/types';
import { t, useLang } from '@/i18n/t';
import { cn } from '@/lib/utils';
import { useAppSelector } from '@/store/store';

/** Where "more games" points (the web hub). */
const HUB_URL = ((import.meta.env.VITE_HUB_URL as string | undefined) ?? '').trim().replace(/\/+$/, '') || DEFAULT_HUB_URL;

/** HAPP-2 one game card on the hub home: opens the game, or "coming soon". */
function GameCard({ game }: { game: ClientGame }) {
  const soon = !isPlayable(game);
  const body = (
    <Card className={cn('h-full flex-row items-center gap-4', soon ? 'opacity-50' : 'transition-colors hover:bg-accent')}>
      <game.Icon className="size-14 shrink-0 text-amber-400" />
      <CardHeader className="flex-1">
        <CardTitle>{t(game.nameKey)}</CardTitle>
        <CardDescription>{t(game.taglineKey)}</CardDescription>
      </CardHeader>
      {soon && <span className="rounded-full bg-muted px-2 py-1 text-xs">{t('play.soon')}</span>}
    </Card>
  );
  if (soon) return <div aria-disabled="true" data-testid={`game-${game.id}`}>{body}</div>;
  return (
    <Link to={gamePath(game.id)} data-testid={`game-${game.id}`} className="rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring">
      {body}
    </Link>
  );
}

/** HAPP-2 COS-2: coins and the daily bonus (the Header claims it once a day). */
function DailyBonus() {
  const user = useAppSelector((s) => s.auth.user);
  return (
    <Card className="flex-row items-center gap-3 p-4" data-testid="daily-bonus">
      <Coins className="size-8 shrink-0 text-amber-400" />
      <p className="flex-1 text-sm">{user ? t('hub.bonus', { coins: user.coins }) : t('hub.bonusSignIn')}</p>
      {!user && <Button asChild size="sm" variant="outline"><Link to="/login">{t('nav.login')}</Link></Button>}
    </Card>
  );
}

/** HAPP-2 the web / hub-app home: game cards, saved games to continue, daily bonus. */
function HubHome({ games }: { games: readonly ClientGame[] }) {
  const name = useAppName();
  const saved = games.filter((g) => g.routes.localGame && g.hasSave?.());
  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-4">
      <div className="flex flex-col gap-1 text-center">
        <h2 className="text-3xl font-bold">{name}</h2>
        <p className="text-muted-foreground">{t('hub.tagline')}</p>
      </div>
      {saved.map((g) => (
        <Button key={g.id} asChild size="lg" variant="secondary" data-testid={`continue-${g.id}`}>
          <Link to={gamePath(g.id, 'local/play')}>{t('hub.continue', { game: t(g.nameKey) })}</Link>
        </Button>
      ))}
      <DailyBonus />
      <div className="flex flex-col gap-3" data-testid="hub-games">
        {games.map((g) => <GameCard key={g.id} game={g} />)}
      </div>
    </div>
  );
}

/** HAPP-3 a one-game app: links to the other games on the web hub. */
function MoreGames({ game }: { game: ClientGame }) {
  const others = ALL_GAMES.filter((g) => g.id !== game.id);
  return (
    <div className="flex w-full flex-col gap-2 border-t border-border pt-4" data-testid="more-games">
      <p className="text-sm font-semibold">{t('hub.moreGames')}</p>
      <div className="flex flex-wrap justify-center gap-2">
        {others.map((g) => (
          <a key={g.id} href={`${HUB_URL}${gamePath(g.id)}`} target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-1.5 rounded-full bg-muted px-3 py-1.5 text-sm hover:bg-accent">
            <g.Icon className="size-4" />{t(g.nameKey)}
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
  return (
    <div className="mx-auto flex w-full max-w-sm flex-1 flex-col items-center justify-center gap-6 text-center" data-testid="game-home">
      <game.Icon className="w-40" />
      <div className="flex flex-col gap-1">
        <h2 className="text-3xl font-bold">{name}</h2>
        <p className="text-muted-foreground">{t(game.taglineKey)}</p>
      </div>
      <div className="flex w-full flex-col gap-3">
        {saved && (
          <Button asChild size="lg" variant="secondary">
            <Link to={gamePath(game.id, 'local/play')}>{t('home.resume')}</Link>
          </Button>
        )}
        <Button asChild size="lg">
          <Link to={gamePath(game.id)}><Play />{t('home.play')}</Link>
        </Button>
        {game.routes.howToPlay && (
          <Button asChild size="lg" variant="outline">
            <Link to={gamePath(game.id, 'how-to-play')}><BookOpen />{t('nav.howTo')}</Link>
          </Button>
        )}
        <Button asChild size="lg" variant="outline">
          <Link to="/settings"><Settings />{t('nav.settings')}</Link>
        </Button>
      </div>
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
