import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
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
    current: { reset() {}, setSeat() {}, load() {}, setLocked() {}, setClock() {}, playBot() {}, cancelBot() {} },
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

  it('UI-1 BOT-6 /play renders the play menu; vs bot works, online is disabled', async () => {
    show('/play');
    expect(await heading(en['play.title'])).toBeTruthy();
    expect(screen.getByTestId('mode-local').getAttribute('href')).toBe('/local/setup');
    expect(screen.getByTestId('mode-bot').getAttribute('href')).toBe('/local/setup?vs=bot');
    expect(screen.getByTestId('mode-online').getAttribute('aria-disabled')).toBe('true');
    expect(screen.getAllByText(en['play.soon'])).toHaveLength(1);
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
