import { createBrowserRouter, Navigate, RouterProvider, type RouteObject } from 'react-router';
import { RootLayout } from './roots/RootLayout';
import { DevDeterminism } from './roots/pages/DevDeterminism';
import { Home } from './roots/pages/Home';
import { HowToPlay } from './roots/pages/HowToPlay';
import { JoinByCode } from './roots/pages/JoinByCode';
import { Leaderboard } from './roots/pages/Leaderboard';
import { Lobby } from './roots/pages/Lobby';
import { LocalGame } from './roots/pages/LocalGame';
import { LocalSetup } from './roots/pages/LocalSetup';
import { Login } from './roots/pages/Login';
import { OnlineGame } from './roots/pages/OnlineGame';
import { OnlineMenu } from './roots/pages/OnlineMenu';
import { PlayMenu } from './roots/pages/PlayMenu';
import { Queue } from './roots/pages/Queue';
import { Profile } from './roots/pages/Profile';
import { Register } from './roots/pages/Register';
import { Sandbox } from './roots/pages/Sandbox';
import { Settings } from './roots/pages/Settings';
import { Shop } from './roots/pages/Shop';

/** UI-1: every screen sits under RootLayout; unknown paths go home. */
export const routes: RouteObject[] = [
  {
    path: '/',
    element: <RootLayout />,
    children: [
      { index: true, element: <Home /> },
      { path: 'play', element: <PlayMenu /> },
      { path: 'local/setup', element: <LocalSetup /> },
      { path: 'local/play', element: <LocalGame /> },
      { path: 'online', element: <OnlineMenu /> },
      { path: 'online/lobby', element: <Lobby /> },
      { path: 'online/game', element: <OnlineGame /> },
      { path: 'join/:code', element: <JoinByCode /> },
      { path: 'ranked', element: <Queue /> },
      { path: 'leaderboard', element: <Leaderboard /> },
      { path: 'shop', element: <Shop /> },
      { path: 'settings', element: <Settings /> },
      { path: 'how-to-play', element: <HowToPlay /> },
      { path: 'login', element: <Login /> },
      { path: 'register', element: <Register /> },
      { path: 'profile', element: <Profile /> },
      { path: 'dev/sandbox', element: <Sandbox /> },
      { path: 'dev/determinism', element: <DevDeterminism /> },
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
];

const router = createBrowserRouter(routes);

export function App() {
  return <RouterProvider router={router} />;
}
