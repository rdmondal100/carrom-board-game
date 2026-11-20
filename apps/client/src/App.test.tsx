import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen, within } from '@testing-library/react';
import { Provider } from 'react-redux';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { routes } from './App';
import { startLocal } from './game/localGame';
import { saveGame } from './game/save';
import en from './i18n/en.json';
import { setLang } from './i18n/t';
import { store } from './store/store';

// Pixi needs WebGL, which jsdom lacks; the board page's chrome is what UI-1 checks.
vi.mock('./game/useBoardCanvas', () => ({
  useBoardCanvas: () => ({
    current: {
      reset() {}, setSeat() {}, load() {}, setLocked() {}, setClock() {}, playBot() {}, cancelBot() {}, replay() {}, showAim() {},
      setSkins() {},
    },
  }),
}));

function show(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  render(<Provider store={store}><RouterProvider router={router} /></Provider>);
  return router;
}

const heading = (text: string) => screen.findByRole('heading', { name: text });

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

  it('UI-1 / renders Home', async () => {
    show('/');
    expect(await screen.findByText(en['home.tagline'])).toBeTruthy();
  });

  it('UI-1 BOT-6 ROOM-11 /play renders the play menu; every mode is enabled', async () => {
    show('/play');
    expect(await heading(en['play.title'])).toBeTruthy();
    expect(screen.getByTestId('mode-local').getAttribute('href')).toBe('/local/setup');
    expect(screen.getByTestId('mode-bot').getAttribute('href')).toBe('/local/setup?vs=bot');
    expect(screen.getByTestId('mode-online').getAttribute('href')).toBe('/online');
    expect(screen.getByTestId('mode-ranked').getAttribute('href')).toBe('/ranked');
    expect(screen.getByTestId('leaderboard-link').getAttribute('href')).toBe('/leaderboard');
    expect(screen.queryAllByText(en['play.soon'])).toHaveLength(0);
  });

  it('BOT-6 vs bot setup seats a medium bot as player 2', async () => {
    show('/local/setup?vs=bot');
    expect(await heading(en['setup.titleBot'])).toBeTruthy();
    expect(screen.getByTestId('seat-0').textContent).toContain(en['setup.seat.human']);
    expect(screen.getByTestId('seat-1').textContent).toContain(en['setup.seat.medium']);
  });

  it('UI-1 /local/setup renders setup', async () => {
    show('/local/setup');
    expect(await heading(en['setup.title'])).toBeTruthy();
  });

  it('UI-1 /local/play without a save goes to setup', async () => {
    const router = show('/local/play');
    expect(await heading(en['setup.title'])).toBeTruthy();
    expect(router.state.location.pathname).toBe('/local/setup');
  });

  it('UI-1 /local/play with a save renders the game', async () => {
    saveGame(startLocal({ format: '1v1', preset: 'colour', length: { kind: 'board' }, seed: 7 }, ['Rina', 'Tuhin'], false));
    show('/local/play');
    expect(await screen.findByTestId('board-host')).toBeTruthy();
    expect(screen.getByRole('button', { name: en['hud.pause'] })).toBeTruthy();
  });

  it('ROOM-11 ROOM-2 /online asks a signed-out player to sign in first', async () => {
    show('/online');
    expect(await heading(en['online.title'])).toBeTruthy();
    const link = within(screen.getByRole('main')).getByRole('link', { name: en['online.signIn'] });
    expect(link.getAttribute('href')).toBe('/login?next=%2Fonline');
  });

  it('ROOM-1 /join/:code keeps the code through sign-in', async () => {
    show('/join/abc234');
    expect(await heading('Room ABC234')).toBeTruthy();
    const link = within(screen.getByRole('main')).getByRole('link', { name: en['online.signIn'] });
    expect(link.getAttribute('href')).toBe('/login?next=%2Fjoin%2FABC234');
  });

  it('ROOM-8 /online/lobby with no room to rejoin goes to the online menu', async () => {
    const router = show('/online/lobby');
    expect(await heading(en['online.title'])).toBeTruthy();
    expect(router.state.location.pathname).toBe('/online');
  });

  it('UI-1 /settings renders settings', async () => {
    show('/settings');
    expect(await heading(en['settings.title'])).toBeTruthy();
    expect(screen.getByRole('switch', { name: en['settings.rotate'] })).toBeTruthy();
  });

  it('UI-1 /how-to-play renders every section', async () => {
    show('/how-to-play');
    expect(await heading(en['howto.title'])).toBeTruthy();
    for (const id of ['goal', 'shoot', 'colour', 'point', 'queen', 'lastCoin', 'turns']) {
      expect(screen.getByRole('heading', { name: en[`howto.${id}.title` as keyof typeof en] })).toBeTruthy();
    }
    expect(screen.queryByText(/\{\w+\}/)).toBeNull();
  });

  it('UI-1 unknown route goes to Home', async () => {
    const router = show('/no/such/page');
    expect(await screen.findByText(en['home.tagline'])).toBeTruthy();
    expect(router.state.location.pathname).toBe('/');
  });

  it('UI-3 switching language changes the shown text', async () => {
    show('/');
    await screen.findByText(en['home.tagline']);
    screen.getByRole('button', { name: 'বাংলা' }).click();
    expect(await screen.findByText(/বাংলাদেশি ক্যারম/)).toBeTruthy();
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

  it('RANK-8 /ranked asks a signed-out player to sign in first', async () => {
    show('/ranked');
    expect(await screen.findByText(en['online.signInFirst'])).toBeTruthy();
  });

  it('RANK-8 /leaderboard renders its page', async () => {
    show('/leaderboard');
    expect(await heading(en['leaderboard.title'])).toBeTruthy();
  });

  describe('offline', () => {
    afterEach(() => { vi.restoreAllMocks(); });
    const goOffline = () => vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);

    it('APP-9 online pages show the offline message when navigator.onLine is false', async () => {
      goOffline();
      for (const path of ['/online', '/join/ABCD', '/ranked', '/leaderboard', '/login']) {
        show(path);
        expect(await heading(en['offline.title'])).toBeTruthy();
        expect(screen.getByRole('link', { name: en['offline.bot'] }).getAttribute('href')).toBe('/local/setup?vs=bot');
        cleanup();
      }
    });

    it('APP-9 Vs-bot setup and the menus still work offline', async () => {
      goOffline();
      show('/local/setup?vs=bot');
      expect(await heading(en['setup.titleBot'])).toBeTruthy();
      expect(screen.queryByTestId('offline')).toBeNull();
      cleanup();
      show('/play');
      expect(await heading(en['play.title'])).toBeTruthy();
    });

    it('APP-9 the online page comes back when the network does', async () => {
      const spy = goOffline();
      show('/online');
      expect(await heading(en['offline.title'])).toBeTruthy();
      spy.mockReturnValue(true);
      act(() => { window.dispatchEvent(new Event('online')); });
      expect(screen.queryByTestId('offline')).toBeNull();
    });
  });
});
