import { createBrowserRouter, Navigate, RouterProvider, type RouteObject } from 'react-router';
import { RootLayout } from './roots/RootLayout';
import { DevDeterminism } from './roots/pages/DevDeterminism';
import { Home } from './roots/pages/Home';
import { HowToPlay } from './roots/pages/HowToPlay';
import { LocalGame } from './roots/pages/LocalGame';
import { LocalSetup } from './roots/pages/LocalSetup';
import { PlayMenu } from './roots/pages/PlayMenu';
import { Sandbox } from './roots/pages/Sandbox';
import { Settings } from './roots/pages/Settings';

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
      { path: 'settings', element: <Settings /> },
      { path: 'how-to-play', element: <HowToPlay /> },
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
