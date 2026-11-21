import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen, within } from '@testing-library/react';
import { Provider } from 'react-redux';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { makeRoutes } from './App';
import { gamesFor } from './games/registry';
import type { ClientGame } from './games/types';
import { startLocal } from './games/carrom/localGame';
import { saveGame } from './games/carrom/save';
import en from './i18n/en.json';
import { setLang } from './i18n/t';
import { store } from './store/store';

// Pixi needs WebGL, which jsdom lacks; the board page's chrome is what UI-1 checks.
vi.mock('./games/carrom/useBoardCanvas', () => ({
  useBoardCanvas: () => ({
    current: {
      reset() {}, setSeat() {}, load() {}, setLocked() {}, setClock() {}, playBot() {}, cancelBot() {}, replay() {}, showAim() {},
      setSkins() {},
    },
  }),
}));

/** HAPP-3 the web / hub build (every game) unless a test passes a one-game build. */
function show(path: string, games: readonly ClientGame[] = gamesFor('all')) {
  const router = createMemoryRouter(makeRoutes(games), { initialEntries: [path] });
  render(<Provider store={store}><RouterProvider router={router} /></Provider>);
  return router;
}

const heading = (text: string | RegExp) => screen.findByRole('heading', { name: text });
const at = (router: { state: { location: { pathname: string } } }) => router.state.location.pathname;

describe('routes', () => {
  beforeAll(() => {
    vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
    vi.stubGlobal('matchMedia', () => ({ matches: false, addEventListener() {}, removeEventListener() {} }));
  });
  beforeEach(() => {
    localStorage.clear();
    setLang('en');
  });
  afterEach(cleanup);

  it('UI-1 HAPP-2 / renders the hub: a card per game, coming-soon games disabled, daily bonus', async () => {
    show('/');
    expect(await screen.findByText(en['hub.tagline'])).toBeTruthy();
    expect(screen.getByTestId('game-carrom').getAttribute('href')).toBe('/g/carrom/play');
    expect(screen.getByTestId('game-ludo').getAttribute('href')).toBe('/g/ludo/play');
    expect(screen.getByTestId('game-callbreak').getAttribute('href')).toBe('/g/callbreak/play');
    for (const id of ['nodipar']) expect(screen.getByTestId(`game-${id}`).getAttribute('aria-disabled')).toBe('true');
    expect(screen.getByTestId('daily-bonus')).toBeTruthy();
    expect(screen.queryByTestId('game-home')).toBeNull();
  });

  it('HAPP-2 the hub offers to continue a saved local game', async () => {
    saveGame(startLocal({ format: '1v1', preset: 'colour', length: { kind: 'board' }, seed: 7 }, ['Rina', 'Tuhin'], false));
    show('/');
    expect((await screen.findByTestId('continue-carrom')).getAttribute('href')).toBe('/g/carrom/local/play');
  });

  it('HAPP-3 one-game build: / shows the game home, no hub cards, a more-games row', async () => {
    show('/', gamesFor('carrom'));
    expect(await screen.findByTestId('game-home')).toBeTruthy();
    expect(screen.getByText(en['games.carrom.tagline'])).toBeTruthy();
    expect(screen.queryByTestId('hub-games')).toBeNull();
    expect(screen.queryByTestId('game-carrom')).toBeNull();
    expect(within(screen.getByTestId('more-games')).getByText(en['games.ludo.name'])).toBeTruthy();
  });

  it('HAPP-3 one-game build: another game goes home', async () => {
    const router = show('/g/ludo/play', gamesFor('carrom'));
    expect(await screen.findByTestId('game-home')).toBeTruthy();
    expect(at(router)).toBe('/');
  });

  it('HAPP-2 every old path redirects to its /g/carrom page', async () => {
    const exact: [string, string, string?][] = [
      ['/play', '/g/carrom/play'], ['/local/setup', '/g/carrom/local/setup'], ['/local/setup?vs=bot', '/g/carrom/local/setup', '?vs=bot'],
      ['/online', '/g/carrom/online'], ['/ranked', '/g/carrom/ranked'], ['/leaderboard', '/g/carrom/leaderboard'],
      ['/how-to-play', '/g/carrom/how-to-play'],
    ];
    for (const [from, to, search] of exact) {
      const router = show(from);
      await vi.waitFor(() => expect(at(router)).toBe(to));
      if (search) expect(router.state.location.search).toBe(search);
      cleanup();
    }
    // These send you on when there is nothing to show (no save, no room): still under /g/carrom.
    for (const from of ['/local/play', '/online/lobby', '/online/game']) {
      const router = show(from);
      await vi.waitFor(() => expect(at(router)).toMatch(/^\/g\/carrom\//));
      cleanup();
    }
  });

  it('HAPP-2 an unknown game id goes to the hub home', async () => {
    const router = show('/g/nope/play');
    expect(await screen.findByText(en['hub.tagline'])).toBeTruthy();
    expect(at(router)).toBe('/');
  });

  it('HAPP-1 a coming-soon game: every mode "coming soon"; its pages go to its play menu', async () => {
    const router = show('/g/nodipar/local/setup');
    expect(await heading(new RegExp(en['play.title']))).toBeTruthy();
    expect(at(router)).toBe('/g/nodipar/play');
    expect(screen.getAllByText(en['play.soon'])).toHaveLength(4);
  });

  it('UI-1 BOT-6 ROOM-11 HAPP-2 /g/carrom/play renders the play menu; every mode is enabled', async () => {
    show('/g/carrom/play');
    expect(await heading(new RegExp(en['play.title']))).toBeTruthy();
    expect(screen.getByTestId('mode-local').getAttribute('href')).toBe('/g/carrom/local/setup');
    expect(screen.getByTestId('mode-bot').getAttribute('href')).toBe('/g/carrom/local/setup?vs=bot');
    expect(screen.getByTestId('mode-online').getAttribute('href')).toBe('/g/carrom/online');
    expect(screen.getByTestId('mode-ranked').getAttribute('href')).toBe('/g/carrom/ranked');
    expect(screen.getByTestId('leaderboard-link').getAttribute('href')).toBe('/g/carrom/leaderboard');
    expect(screen.queryAllByText(en['play.soon'])).toHaveLength(0);
  });

  it('BOT-6 vs bot setup seats a medium bot as player 2', async () => {
    show('/g/carrom/local/setup?vs=bot');
    expect(await heading(en['setup.titleBot'])).toBeTruthy();
    expect(screen.getByTestId('seat-0').textContent).toContain(en['setup.seat.human']);
    expect(screen.getByTestId('seat-1').textContent).toContain(en['setup.seat.medium']);
  });

  it('UI-1 /g/carrom/local/setup renders setup', async () => {
    show('/g/carrom/local/setup');
    expect(await heading(en['setup.title'])).toBeTruthy();
  });

  it('UI-1 /g/carrom/local/play without a save goes to setup', async () => {
    const router = show('/g/carrom/local/play');
    expect(await heading(en['setup.title'])).toBeTruthy();
    expect(router.state.location.pathname).toBe('/g/carrom/local/setup');
  });

  it('UI-1 /g/carrom/local/play with a save renders the game', async () => {
    saveGame(startLocal({ format: '1v1', preset: 'colour', length: { kind: 'board' }, seed: 7 }, ['Rina', 'Tuhin'], false));
    show('/g/carrom/local/play');
    expect(await screen.findByTestId('board-host')).toBeTruthy();
    expect(screen.getByRole('button', { name: en['hud.pause'] })).toBeTruthy();
  });

  it('ROOM-11 ROOM-2 /g/carrom/online asks a signed-out player to sign in first', async () => {
    show('/g/carrom/online');
    expect(await heading(en['online.title'])).toBeTruthy();
    const link = within(screen.getByRole('main')).getByRole('link', { name: en['online.signIn'] });
    expect(link.getAttribute('href')).toBe('/login?next=%2Fg%2Fcarrom%2Fonline');
  });

  it('ROOM-1 /join/:code keeps the code through sign-in', async () => {
    show('/join/abc234');
    expect(await heading('Room ABC234')).toBeTruthy();
    const link = within(screen.getByRole('main')).getByRole('link', { name: en['online.signIn'] });
    expect(link.getAttribute('href')).toBe('/login?next=%2Fjoin%2FABC234');
  });

  it('ROOM-8 /g/carrom/online/lobby with no room to rejoin goes to the online menu', async () => {
    const router = show('/g/carrom/online/lobby');
    expect(await heading(en['online.title'])).toBeTruthy();
    expect(router.state.location.pathname).toBe('/g/carrom/online');
  });

  it('UI-1 /settings renders settings', async () => {
    show('/settings');
    expect(await heading(en['settings.title'])).toBeTruthy();
    expect(await screen.findByRole('switch', { name: en['settings.rotate'] })).toBeTruthy();
  });

  it('UI-1 /g/carrom/how-to-play renders every section', async () => {
    show('/g/carrom/how-to-play');
    expect(await heading(en['howto.title'])).toBeTruthy();
    for (const id of ['goal', 'shoot', 'colour', 'point', 'queen', 'lastCoin', 'turns']) {
      expect(screen.getByRole('heading', { name: en[`howto.${id}.title` as keyof typeof en] })).toBeTruthy();
    }
    expect(screen.queryByText(/\{\w+\}/)).toBeNull();
  });

  it('UI-1 unknown route goes to Home', async () => {
    const router = show('/no/such/page');
    expect(await screen.findByText(en['hub.tagline'])).toBeTruthy();
    expect(router.state.location.pathname).toBe('/');
  });

  it('UI-3 switching language changes the shown text', async () => {
    show('/');
    await screen.findByText(en['hub.tagline']);
    screen.getByRole('button', { name: 'বাংলা' }).click();
    expect(await screen.findByText(/ক্যারম, লুডো/)).toBeTruthy();
    setLang('en');
  });
});

describe('auth routes', () => {
  beforeAll(() => {
    vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
  });
  beforeEach(() => {
    localStorage.clear();
    setLang('en');
  });
  afterEach(cleanup);

  it('AUTH-9 /login renders the form and the guest button; the header links to it', async () => {
    show('/login');
    expect(await heading(en['auth.login.title'])).toBeTruthy();
    expect(screen.getByLabelText(en['auth.email'])).toBeTruthy();
    expect(screen.getByRole('button', { name: en['auth.guest'] })).toBeTruthy();
    expect(screen.getByTestId('nav-account').getAttribute('href')).toBe('/login');
  });

  it('AUTH-9 /register renders the form', async () => {
    show('/register');
    expect(await heading(en['auth.register.title'])).toBeTruthy();
    expect(screen.getByLabelText(en['auth.confirm'])).toBeTruthy();
  });

  it('AUTH-9 /profile when signed out goes to /login', async () => {
    const router = show('/profile');
    expect(await heading(en['auth.login.title'])).toBeTruthy();
    expect(router.state.location.pathname).toBe('/login');
  });

  it('RANK-8 /g/carrom/ranked asks a signed-out player to sign in first', async () => {
    show('/g/carrom/ranked');
    expect(await screen.findByText(en['online.signInFirst'])).toBeTruthy();
  });

  it('RANK-8 /g/carrom/leaderboard renders its page', async () => {
    show('/g/carrom/leaderboard');
    expect(await heading(new RegExp(en['leaderboard.title']))).toBeTruthy();
  });

  describe('offline', () => {
    afterEach(() => { vi.restoreAllMocks(); });
    const goOffline = () => vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);

    it('APP-9 online pages show the offline message when navigator.onLine is false', async () => {
      goOffline();
      for (const path of ['/g/carrom/online', '/join/ABCD', '/g/carrom/ranked', '/g/carrom/leaderboard', '/login']) {
        show(path);
        expect(await heading(en['offline.title'])).toBeTruthy();
        expect(screen.getByRole('link', { name: en['offline.bot'] }).getAttribute('href')).toBe('/g/carrom/local/setup?vs=bot');
        cleanup();
      }
    });

    it('APP-9 Vs-bot setup and the menus still work offline', async () => {
      goOffline();
      show('/g/carrom/local/setup?vs=bot');
      expect(await heading(en['setup.titleBot'])).toBeTruthy();
      expect(screen.queryByTestId('offline')).toBeNull();
      cleanup();
      show('/g/carrom/play');
      expect(await heading(new RegExp(en['play.title']))).toBeTruthy();
    });

    it('APP-9 the online page comes back when the network does', async () => {
      const spy = goOffline();
      show('/g/carrom/online');
      expect(await heading(en['offline.title'])).toBeTruthy();
      spy.mockReturnValue(true);
      act(() => { window.dispatchEvent(new Event('online')); });
      expect(screen.queryByTestId('offline')).toBeNull();
    });
  });
});
