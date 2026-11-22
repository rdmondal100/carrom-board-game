import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { Provider } from 'react-redux';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import type { LobbyView } from '@carrom/protocol';
import { GamesProvider } from '@/games/GamesContext';
import { ALL_GAMES } from '@/games/registry';
import en from '@/i18n/en.json';
import { setLang } from '@/i18n/t';
import { sendToRoom } from '@/lib/colyseus';
import { lobbyChanged } from '@/store/roomSlice';
import { makeStore } from '@/store/store';
import { NextGameBar } from './AddaController';

vi.mock('@/lib/colyseus', async (orig) => ({ ...(await orig<typeof import('@/lib/colyseus')>()), sendToRoom: vi.fn() }));

const lobby = (over: Partial<LobbyView>): LobbyView => ({
  code: 'ABCDEF', phase: 'ended', gameId: 'carrom', config: '{}', hostId: '', ranked: false, groupId: 'g1', players: {}, ...over,
});

function show(l: LobbyView) {
  const store = makeStore();
  store.dispatch(lobbyChanged(l));
  render(<Provider store={store}><GamesProvider games={ALL_GAMES}><NextGameBar /></GamesProvider></Provider>);
}

describe('ADDA-4 next game bar', () => {
  beforeAll(() => setLang('en'));
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('ADDA-4 shows after a group room\'s game and sends the pick (Callbreak is always 4)', () => {
    show(lobby({}));
    fireEvent.click(screen.getByRole('radio', { name: /Ludo/ }));
    fireEvent.click(screen.getByRole('radio', { name: '4 players' }));
    fireEvent.click(screen.getByRole('button', { name: en['adda.next.go'] }));
    expect(sendToRoom).toHaveBeenLastCalledWith({ type: 'nextGame', gameId: 'ludo', players: 4 });

    fireEvent.click(screen.getByRole('radio', { name: /Callbreak/ }));
    fireEvent.click(screen.getByRole('radio', { name: '2 players' }));
    fireEvent.click(screen.getByRole('button', { name: en['adda.next.go'] }));
    expect(sendToRoom).toHaveBeenLastCalledWith({ type: 'nextGame', gameId: 'callbreak', players: 4 });
  });

  it('ADDA-4 hidden in a room without a group, and while the game runs', () => {
    show(lobby({ groupId: '' }));
    expect(screen.queryByTestId('next-game')).toBeNull();
    cleanup();
    show(lobby({ phase: 'playing' }));
    expect(screen.queryByTestId('next-game')).toBeNull();
  });
});
