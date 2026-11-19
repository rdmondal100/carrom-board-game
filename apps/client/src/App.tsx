import { createBrowserRouter, RouterProvider } from 'react-router';
import { RootLayout } from './roots/RootLayout';
import { Sandbox } from './roots/pages/Sandbox';
import { DevDeterminism } from './roots/pages/DevDeterminism';

const router = createBrowserRouter([
  {
    path: '/',
    element: <RootLayout />,
    children: [
      { index: true, element: <Sandbox /> },
      { path: 'dev/determinism', element: <DevDeterminism /> },
    ],
  },
]);

export function App() {
  return <RouterProvider router={router} />;
}
