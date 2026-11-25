import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { Provider } from 'react-redux';
import { createMemoryRouter, RouterProvider, useParams } from 'react-router';
import type { LobbyView } from '@carrom/protocol';
import { lobbyChanged } from '@/store/roomSlice';
import { store } from '@/store/store';
import { useOnlineRoom } from './OnlineParts';

/** Stands in for a game's room page: the game comes from the URL, like the real routes. */
function Probe() {
  const game = useParams().id ?? '';
  const { lobby } = useOnlineRoom(game);
  return <p data-testid="probe">{game}:{lobby ? lobby.gameId : 'none'}</p>;
}

const lobby = (gameId: string, phase: LobbyView['phase']): LobbyView =>
  ({ code: 'ABCD', phase, gameId, config: '{}', hostId: 'h', ranked: false, players: {} });

function show(path: string) {
  const router = createMemoryRouter([
    { path: '/g/:id/online/game', element: <Probe /> },
  ], { initialEntries: [path] });
  render(<Provider store={store}><RouterProvider router={router} /></Provider>);
  return router;
}

describe('online room hook', () => {
  afterEach(() => {
    cleanup();
    store.dispatch(lobbyChanged(null));
  });

  it('HUB-4 a room of another game is not handed to this page; the player goes to that game', async () => {
    store.dispatch(lobbyChanged(lobby('ludo', 'playing')));
    const router = show('/g/carrom/online/game');
    // Carrom's page never sees the Ludo room; Ludo's page gets it.
    expect(await screen.findByText('ludo:ludo')).toBeTruthy();
    expect(router.state.location.pathname).toBe('/g/ludo/online/game');
  });

  it('HUB-4 the same game passes through', () => {
    store.dispatch(lobbyChanged(lobby('carrom', 'playing')));
    show('/g/carrom/online/game');
    expect(screen.getByTestId('probe').textContent).toBe('carrom:carrom');
  });
});
