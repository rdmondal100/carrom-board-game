import { createBrowserRouter, RouterProvider } from 'react-router';
import { RootLayout } from './roots/RootLayout';
import { Sandbox } from './roots/pages/Sandbox';
import { DevDeterminism } from './roots/pages/DevDeterminism';
import { LocalGame } from './roots/pages/LocalGame';
import { LocalSetup } from './roots/pages/LocalSetup';

const router = createBrowserRouter([
  {
    path: '/',
    element: <RootLayout />,
    children: [
      { index: true, element: <Sandbox /> },
      { path: 'dev/determinism', element: <DevDeterminism /> },
      { path: 'local/setup', element: <LocalSetup /> },
      { path: 'local/play', element: <LocalGame /> },
    ],
  },
]);

export function App() {
  return <RouterProvider router={router} />;
}
