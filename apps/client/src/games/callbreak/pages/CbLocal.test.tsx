import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { Provider } from 'react-redux';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { makeRoutes } from '@/App';
import { gamesFor } from '@/games/registry';
import { setLang } from '@/i18n/t';
import en from '@/i18n/en.json';
import { store } from '@/store/store';
import { botMove, botTurn, ME, startLocal, type LocalCallbreak } from '../localCallbreak';
import { loadCallbreak, saveCallbreak } from '../save';

function show(path: string) {
  const router = createMemoryRouter(makeRoutes(gamesFor('all')), { initialEntries: [path] });
  render(<Provider store={store}><RouterProvider router={router} /></Provider>);
  return router;
}

/** A saved game where the bots before you have called and it is your call. */
function atMyCall(): LocalCallbreak {
  let g = startLocal({ rounds: 3, redeal: true }, ['Rina', 'Bot 2', 'Bot 3', 'Bot 4'], ['medium', 'medium', 'medium', 'medium'], false, 5);
  for (let i = 0; botTurn(g) !== null; i++) g = botMove(g, i)!.game;
  return g;
}

describe('callbreak pages', () => {
  beforeAll(() => {
    vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
    vi.stubGlobal('matchMedia', () => ({ matches: false, addEventListener() {}, removeEventListener() {} }));
  });
  beforeEach(() => {
    localStorage.clear();
    setLang('en');
  });
  afterEach(cleanup);

  it('CB-7 the vs-bot page: table, your 13 cards, and the call picker on your call', async () => {
    const g = atMyCall();
    saveCallbreak(g);
    show('/g/callbreak/local/play');
    // The page is lazy-loaded; under a full parallel run it can take over the default 1 s.
    expect(await screen.findByRole('region', { name: en['callbreak.table'] }, { timeout: 3000 })).toBeTruthy();
    expect(screen.getAllByTestId(/^card-[2-9TJQKA][SHDC]$/)).toHaveLength(13);
    const picker = await screen.findByTestId('bid-picker', undefined, { timeout: 3000 });
    fireEvent.click(picker.querySelectorAll('button')[2]!);
    expect(loadCallbreak()?.state.bids[ME]).toBe(3);
  });

  it('CB-7 without a saved game the page goes to setup; setup starts a game vs three bots', async () => {
    const router = show('/g/callbreak/local/play');
    expect(await screen.findByText(en['callbreak.yourName'])).toBeTruthy();
    expect(router.state.location.pathname).toBe('/g/callbreak/local/setup');
    fireEvent.click(screen.getByRole('button', { name: en['setup.start'] }));
    await vi.waitFor(() => expect(router.state.location.pathname).toBe('/g/callbreak/local/play'));
    expect(loadCallbreak()?.names).toHaveLength(4);
  });
});
