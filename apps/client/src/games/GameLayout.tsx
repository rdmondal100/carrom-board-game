import { Suspense, type ComponentType, type ReactNode } from 'react';
import { Navigate, Outlet, useParams } from 'react-router';
import { t, useLang } from '@/i18n/t';
import { GameProvider, gameIn, useGame, useGames } from './GamesContext';
import { gamePath, type GameRoutes, type PlayModeId } from './types';

function Loading() {
  useLang();
  return <p className="text-center text-muted-foreground">{t('auth.loading')}</p>;
}

/** Shows a lazy page, with a short "loading" while its chunk arrives. */
function Lazy({ Page }: { Page: ComponentType }) {
  return <Suspense fallback={<Loading />}><Page /></Suspense>;
}

/** HAPP-2 `/g/:gameId/*`: a game of this build, else the hub home. */
export function GameLayout() {
  const { games } = useGames();
  const game = gameIn(games, useParams().gameId);
  if (!game) return <Navigate to="/" replace />;
  return <GameProvider key={game.id} game={game}><Outlet /></GameProvider>;
}

/** A shared page that needs one of the game's modes; without it, back to the game's play menu. */
export function GameRoot({ mode, children }: { mode: PlayModeId; children: ReactNode }) {
  const game = useGame();
  if (!game.playModes[mode]) return <Navigate to={gamePath(game.id)} replace />;
  return children;
}

/** HAPP-1 one of the game's own pages; a page the game doesn't have yet goes to its play menu. */
export function GamePage({ page, mode, dev }: { page?: keyof GameRoutes; mode?: PlayModeId; dev?: ComponentType }) {
  if (dev) return <Lazy Page={dev} />;
  return <OwnPage page={page!} mode={mode} />;
}

function OwnPage({ page, mode }: { page: keyof GameRoutes; mode?: PlayModeId }) {
  const game = useGame();
  const Page = game.routes[page];
  if (!Page || (mode && !game.playModes[mode])) return <Navigate to={gamePath(game.id)} replace />;
  return <Lazy Page={Page} />;
}
