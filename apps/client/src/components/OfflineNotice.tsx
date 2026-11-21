import { WifiOff } from 'lucide-react';
import { Link, useLocation } from 'react-router';
import { Button } from '@/components/ui/button';
import { gameIn, useGames } from '@/games/GamesContext';
import { modePath } from '@/games/types';
import { t } from '@/i18n/t';

/** APP-9: shown instead of an online screen while there is no network. Offers the game's offline modes. */
export function OfflineNotice() {
  const { games, single } = useGames();
  const { pathname } = useLocation();
  // The game of this page, else the app's one game, else the first with offline modes (HAPP-2).
  const here = gameIn(games, /^\/g\/([^/]+)/.exec(pathname)?.[1]);
  const game = [here, single, ...games].find((g) => g?.playModes.bot || g?.playModes.local);
  return (
    <div className="m-auto flex max-w-sm flex-col items-center gap-3 text-center" data-testid="offline">
      <WifiOff className="size-10 text-muted-foreground" />
      <h1 className="text-xl font-bold">{t('offline.title')}</h1>
      <p className="text-muted-foreground">{t('offline.body')}</p>
      <div className="flex gap-2">
        {game?.playModes.bot && <Button asChild><Link to={modePath(game.id, 'bot')}>{t('offline.bot')}</Link></Button>}
        {game?.playModes.local && (
          <Button asChild variant="outline"><Link to={modePath(game.id, 'local')}>{t('offline.local')}</Link></Button>
        )}
        {!game && <Button asChild><Link to="/">{t('nav.home')}</Link></Button>}
      </div>
    </div>
  );
}
