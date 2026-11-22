import { createBrowserRouter, Navigate, RouterProvider, useLocation, type RouteObject } from 'react-router';
import { GameLayout, GamePage, GameRoot } from './games/GameLayout';
import { GamesProvider } from './games/GamesContext';
import { BUILD_GAMES } from './games/registry';
import type { ClientGame } from './games/types';
import { RootLayout } from './roots/RootLayout';
import { Friends } from './roots/pages/Friends';
import { Group } from './roots/pages/Group';
import { GroupInvite } from './roots/pages/GroupInvite';
import { Groups } from './roots/pages/Groups';
import { Home } from './roots/pages/Home';
import { JoinByCode } from './roots/pages/JoinByCode';
import { Leaderboard } from './roots/pages/Leaderboard';
import { Login } from './roots/pages/Login';
import { PlayMenu } from './roots/pages/PlayMenu';
import { Profile } from './roots/pages/Profile';
import { Queue } from './roots/pages/Queue';
import { Register } from './roots/pages/Register';
import { Settings } from './roots/pages/Settings';
import { Shop } from './roots/pages/Shop';

/** HAPP-2 paths from before the hub: they were carrom's; keep the rest of the path and the query. */
const LEGACY_PATHS = ['play', 'local/*', 'online', 'online/*', 'ranked', 'leaderboard', 'how-to-play'] as const;

function LegacyRedirect() {
  const { pathname, search, hash } = useLocation();
  return <Navigate to={`/g/carrom${pathname}${search}${hash}`} replace />;
}

/** HAPP-2 `/g/:gameId/...`: shared pages plus the game's own (lazy) pages. */
const gameChildren: RouteObject[] = [
  { index: true, element: <Navigate to="play" replace /> },
  { path: 'play', element: <PlayMenu /> },
  { path: 'local/setup', element: <GamePage page="setup" /> },
  { path: 'local/play', element: <GamePage page="localGame" /> },
  { path: 'online', element: <GamePage page="online" mode="online" /> },
  { path: 'online/lobby', element: <GamePage page="lobby" mode="online" /> },
  { path: 'online/game', element: <GamePage page="onlineGame" /> },
  { path: 'ranked', element: <GameRoot mode="ranked"><Queue /></GameRoot> },
  { path: 'leaderboard', element: <GameRoot mode="ranked"><Leaderboard /></GameRoot> },
  { path: 'how-to-play', element: <GamePage page="howToPlay" /> },
  { path: '*', element: <Navigate to="play" replace /> },
];

/** UI-1 / HAPP-2: every screen sits under RootLayout; unknown paths go home. */
export function makeRoutes(games: readonly ClientGame[]): RouteObject[] {
  const legacy = games.some((g) => g.id === 'carrom') ? LEGACY_PATHS.map((path) => ({ path, element: <LegacyRedirect /> })) : [];
  const dev = games.flatMap((g) => (g.devRoutes ?? []).map((d) => ({ path: d.path, element: <GamePage dev={d.element} /> })));
  return [
    {
      path: '/',
      element: <GamesProvider games={games}><RootLayout /></GamesProvider>,
      children: [
        { index: true, element: <Home /> },
        { path: 'g/:gameId', element: <GameLayout />, children: gameChildren },
        { path: 'join/:code', element: <JoinByCode /> },
        // ADDA-1..3 friends and groups (one account across every game).
        { path: 'friends', element: <Friends /> },
        { path: 'groups', element: <Groups /> },
        { path: 'groups/:id', element: <Group /> },
        { path: 'a/:code', element: <GroupInvite /> },
        { path: 'shop', element: <Shop /> },
        { path: 'settings', element: <Settings /> },
        { path: 'login', element: <Login /> },
        { path: 'register', element: <Register /> },
        { path: 'profile', element: <Profile /> },
        ...dev,
        ...legacy,
        { path: '*', element: <Navigate to="/" replace /> },
      ],
    },
  ];
}

export const routes = makeRoutes(BUILD_GAMES);

const router = createBrowserRouter(routes);

export function App() {
  return <RouterProvider router={router} />;
}
