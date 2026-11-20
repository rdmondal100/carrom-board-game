import axios from 'axios';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { Provider } from 'react-redux';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_EQUIPPED, type PublicUser } from '@carrom/protocol';
import { routes } from '@/App';
import en from '@/i18n/en.json';
import { setLang } from '@/i18n/t';
import { userUpdated } from '@/store/authSlice';
import { makeStore } from '@/store/store';

vi.mock('@/game/useBoardCanvas', () => ({ useBoardCanvas: () => ({ current: {} }) }));
vi.mock('axios', async (orig) => {
  const real = await orig<typeof import('axios')>();
  return { default: { ...real.default, post: vi.fn(), get: vi.fn(), patch: vi.fn() } };
});
const post = vi.mocked(axios.post);
const patch = vi.mocked(axios.patch);

const DEFAULTS = ['classic-striker', 'classic-coins', 'classic-board'];
const user = (over: Partial<PublicUser> = {}): PublicUser => ({
  id: 'u1', name: 'Rina', email: null, isGuest: true, hasPassword: false, hasGoogle: false,
  avatar: 0, rating: 1000, ratings: {}, coins: 500, cosmetics: { equipped: { ...DEFAULT_EQUIPPED }, owned: DEFAULTS },
  createdAt: '2026-11-20T00:00:00.000Z', ...over,
});

function show(u: PublicUser | null) {
  const store = makeStore();
  if (u) store.dispatch(userUpdated(u));
  const router = createMemoryRouter(routes, { initialEntries: ['/shop'] });
  render(<Provider store={store}><RouterProvider router={router} /></Provider>);
  return store;
}

describe('COS-7 shop page', () => {
  beforeAll(() => {
    vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
    vi.stubGlobal('matchMedia', () => ({ matches: false, addEventListener() {}, removeEventListener() {} }));
  });
  beforeEach(() => {
    localStorage.clear();
    setLang('en');
    vi.clearAllMocks();
    // The header claims the daily bonus; answer "already claimed".
    post.mockImplementation(async (url: string) => {
      if (url.endsWith('/me/daily-bonus')) return { data: { reward: 0, user: user() } };
      throw new Error(`unexpected POST ${url}`);
    });
  });
  afterEach(cleanup);

  it('COS-7 signed out: asks to sign in', async () => {
    show(null);
    expect(await screen.findByText(en['shop.signInFirst'])).toBeTruthy();
  });

  it('COS-7 tabs per type, price, balance in the header', async () => {
    show(user());
    expect(await screen.findByRole('heading', { name: en['shop.title'] })).toBeTruthy();
    expect(screen.getByTestId('nav-coins').textContent).toContain('500');
    expect(screen.getByTestId('shop-item-gold-striker').textContent).toContain('400');
    expect(screen.queryByTestId('shop-item-jade-coins')).toBeNull();
    fireEvent.click(screen.getByTestId('shop-tab-coins'));
    expect(screen.getByTestId('shop-item-jade-coins')).toBeTruthy();
    expect(screen.getAllByTestId('skin-preview').length).toBeGreaterThan(1);
  });

  it('COS-7 too expensive: buy is disabled', async () => {
    show(user({ coins: 100 }));
    fireEvent.click(await screen.findByTestId('shop-item-galaxy-striker'));
    expect((screen.getByTestId('shop-buy') as HTMLButtonElement).disabled).toBe(true);
  });

  it('COS-7 buy then equip; the header balance follows', async () => {
    show(user());
    const bought = user({ coins: 100, cosmetics: { equipped: { ...DEFAULT_EQUIPPED }, owned: [...DEFAULTS, 'gold-striker'] } });
    post.mockImplementation(async (url: string) => {
      if (url.endsWith('/shop/buy')) return { data: { user: bought } };
      return { data: { reward: 0, user: user() } };
    });
    fireEvent.click(await screen.findByTestId('shop-item-gold-striker'));
    await act(async () => { fireEvent.click(screen.getByTestId('shop-buy')); });
    await waitFor(() => expect(screen.getByTestId('nav-coins').textContent).toContain('100'));
    expect(post).toHaveBeenCalledWith(expect.stringContaining('/shop/buy'), { itemId: 'gold-striker' }, expect.anything());

    patch.mockResolvedValueOnce({
      data: { user: { ...bought, cosmetics: { ...bought.cosmetics, equipped: { ...DEFAULT_EQUIPPED, striker: 'gold-striker' } } } },
    });
    await act(async () => { fireEvent.click(screen.getByTestId('shop-equip')); });
    expect(patch).toHaveBeenCalledWith(expect.stringContaining('/me/equip'), { striker: 'gold-striker' }, expect.anything());
    expect(await screen.findAllByText(en['shop.equipped'])).not.toHaveLength(0);
  });
});

describe('IAP-6 coin packs on the web', () => {
  beforeAll(() => {
    vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
    vi.stubGlobal('matchMedia', () => ({ matches: false, addEventListener() {}, removeEventListener() {} }));
  });
  beforeEach(() => {
    localStorage.clear();
    setLang('en');
    vi.clearAllMocks();
    post.mockImplementation(async () => ({ data: { reward: 0, user: user() } }));
  });
  afterEach(cleanup);

  it('IAP-6 web shows the Android-only message', async () => {
    show(user());
    expect((await screen.findByTestId('iap-android-only')).textContent).toContain(en['iap.androidOnly']);
    expect(screen.getByTestId('coin-packs').textContent).toContain('2600');
    expect(screen.queryByTestId('iap-coins_500')).toBeNull();
    expect(post).not.toHaveBeenCalledWith(expect.stringContaining('/iap/'), expect.anything(), expect.anything());
  });
});
