import axios from 'axios';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { Provider } from 'react-redux';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_SLOTS, type PublicUser } from '@carrom/protocol';
import { setLang } from '@/i18n/t';
import { userUpdated } from '@/store/authSlice';
import { makeStore } from '@/store/store';
import { CoinPacks, resetRecoveryForTest, usePurchaseRecovery } from './CoinPacks';

const billing = vi.hoisted(() => ({
  billingSupported: vi.fn(() => true),
  loadPacks: vi.fn(async () => [{ productId: 'coins_500', coins: 500, price: '৳250.00' }]),
  purchasePack: vi.fn(async (): Promise<unknown> => ({ productId: 'coins_500', purchaseToken: 'tok-new' })),
  unfinishedPurchases: vi.fn(async (): Promise<unknown[]> => []),
}));
vi.mock('@/lib/billing', () => billing);
vi.mock('axios', async (orig) => {
  const real = await orig<typeof import('axios')>();
  return { default: { ...real.default, post: vi.fn(), get: vi.fn() } };
});
const post = vi.mocked(axios.post);

const user = (coins: number): PublicUser => ({
  id: 'u1', name: 'Rina', email: null, isGuest: true, hasPassword: false, hasGoogle: false, avatar: 0, rating: 1000, ratings: {}, coins,
  cosmetics: { equipped: { ...DEFAULT_SLOTS }, owned: [] }, blocked: [], createdAt: '2026-11-20T00:00:00.000Z',
});

function Recovery() {
  usePurchaseRecovery();
  return null;
}

describe('coin packs on Android', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetRecoveryForTest();
    setLang('en');
  });
  afterEach(cleanup);

  it('IAP-2 a pack shows the store price; buying sends the token to /iap/verify', async () => {
    const store = makeStore();
    store.dispatch(userUpdated(user(0)));
    post.mockResolvedValueOnce({ data: { status: 'credited', credited: 500, user: user(500) } });
    render(<Provider store={store}><CoinPacks userId="u1" /></Provider>);
    const btn = await screen.findByTestId('iap-coins_500');
    expect(btn.textContent).toContain('৳250.00');
    await act(async () => { fireEvent.click(btn); });
    expect(billing.purchasePack).toHaveBeenCalledWith('coins_500', 'u1');
    expect(post).toHaveBeenCalledWith(
      expect.stringContaining('/iap/verify'), { productId: 'coins_500', purchaseToken: 'tok-new' }, expect.anything());
    await waitFor(() => expect(store.getState().auth.user?.coins).toBe(500));
  });

  it('IAP-2 a closed purchase sheet sends nothing', async () => {
    billing.purchasePack.mockResolvedValueOnce(null);
    const store = makeStore();
    render(<Provider store={store}><CoinPacks userId="u1" /></Provider>);
    const btn = await screen.findByTestId('iap-coins_500');
    await act(async () => { fireEvent.click(btn); });
    expect(billing.purchasePack).toHaveBeenCalledTimes(1);
    expect(post).not.toHaveBeenCalled();
  });

  it('IAP-4 retry re-verifies unfinished purchases on app start, once per account', async () => {
    billing.unfinishedPurchases.mockResolvedValue([
      { productId: 'coins_2600', purchaseToken: 'pending-then-done' },
      { productId: 'coins_500', purchaseToken: 'never-verified' },
    ]);
    post.mockResolvedValueOnce({ data: { status: 'credited', credited: 2600, user: user(2600) } })
      .mockResolvedValueOnce({ data: { status: 'credited', credited: 500, user: user(3100) } });
    const store = makeStore();
    render(<Provider store={store}><Recovery /></Provider>);
    expect(billing.unfinishedPurchases).not.toHaveBeenCalled(); // signed out: nothing yet
    act(() => { store.dispatch(userUpdated(user(0))); });
    await waitFor(() => expect(store.getState().auth.user?.coins).toBe(3100));
    expect(billing.unfinishedPurchases).toHaveBeenCalledWith('u1');
    expect(post.mock.calls.map((c) => c[1])).toEqual([
      { productId: 'coins_2600', purchaseToken: 'pending-then-done' },
      { productId: 'coins_500', purchaseToken: 'never-verified' },
    ]);
    // A re-render (or another page) doesn't run it again.
    act(() => { store.dispatch(userUpdated(user(3100))); });
    expect(billing.unfinishedPurchases).toHaveBeenCalledTimes(1);
  });

  it('IAP-4 a failed retry stays quiet', async () => {
    billing.unfinishedPurchases.mockResolvedValue([{ productId: 'coins_500', purchaseToken: 'x' }]);
    post.mockRejectedValueOnce(new Error('offline'));
    const store = makeStore();
    store.dispatch(userUpdated(user(0)));
    render(<Provider store={store}><Recovery /></Provider>);
    await waitFor(() => expect(post).toHaveBeenCalledTimes(1));
    expect(store.getState().auth.user?.coins).toBe(0);
  });
});
