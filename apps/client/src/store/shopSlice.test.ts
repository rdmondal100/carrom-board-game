import axios from 'axios';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_SLOTS, type PublicUser } from '@carrom/protocol';
import { API_BASE } from '@/constants/apiBase';
import { setToken } from '@/lib/auth';
import { buyItem, claimBotReward, claimDailyBonus, equipItems, shopErrorKey } from './shopSlice';
import { makeStore } from './store';

vi.mock('axios', async (orig) => {
  const real = await orig<typeof import('axios')>();
  return { default: { ...real.default, post: vi.fn(), get: vi.fn(), patch: vi.fn() } };
});
const post = vi.mocked(axios.post);
const patch = vi.mocked(axios.patch);

const user = (over: Partial<PublicUser> = {}): PublicUser => ({
  id: 'u1', name: 'Rina', email: null, isGuest: true, hasPassword: false, hasGoogle: false,
  avatar: 0, rating: 1000, ratings: {}, xp: 0, level: 1, coins: 500,
  cosmetics: { equipped: { ...DEFAULT_SLOTS }, owned: ['classic-striker', 'classic-coins', 'classic-board'] },
  blocked: [], createdAt: '2026-11-20T00:00:00.000Z',
  ...over,
});

function httpError(status: number, error: string) {
  return new axios.AxiosError('Request failed', 'ERR_BAD_REQUEST', undefined, undefined,
    { status, data: { error }, statusText: '', headers: {}, config: {} as never });
}

describe('shopSlice', () => {
  beforeEach(() => {
    localStorage.clear();
    setToken('tok');
    vi.clearAllMocks();
  });

  it('COS-7 buy posts the item with the token; the new balance reaches the header (auth user)', async () => {
    const store = makeStore();
    const after = user({ coins: 100, cosmetics: { equipped: { ...DEFAULT_SLOTS }, owned: ['gold-striker'] } });
    post.mockResolvedValueOnce({ data: { user: after } });
    await store.dispatch(buyItem('gold-striker'));
    expect(post).toHaveBeenCalledWith(`${API_BASE}/shop/buy`, { itemId: 'gold-striker' },
      { headers: { Authorization: 'Bearer tok' } });
    expect(store.getState().auth.user?.coins).toBe(100);
    expect(store.getState().shop).toEqual({ busy: null, error: null, adsLeft: null });
  });

  it('COS-7 a refused buy keeps the user and stores the failure', async () => {
    const store = makeStore();
    post.mockRejectedValueOnce(httpError(400, 'Not enough coins'));
    await store.dispatch(buyItem('gold-striker'));
    const err = store.getState().shop.error!;
    expect(err).toEqual({ action: 'buy', status: 400, error: 'Not enough coins' });
    expect(shopErrorKey(err)).toBe('shop.err.coins');
    expect(shopErrorKey({ action: 'buy', status: 409, error: '' })).toBe('shop.err.owned');
    expect(shopErrorKey({ action: 'equip', status: 403, error: '' })).toBe('shop.err.notOwned');
  });

  it('COS-7 equip patches /me/equip and stores the user', async () => {
    const store = makeStore();
    const eq = { ...DEFAULT_SLOTS, carrom: { ...DEFAULT_SLOTS.carrom, striker: 'gold-striker' } };
    patch.mockResolvedValueOnce({ data: { user: user({ cosmetics: { equipped: eq, owned: [] } }) } });
    await store.dispatch(equipItems({ striker: 'gold-striker' }));
    expect(patch.mock.calls[0]?.slice(0, 2)).toEqual([`${API_BASE}/me/equip`, { striker: 'gold-striker' }]);
    expect(store.getState().auth.user?.cosmetics.equipped.carrom.striker).toBe('gold-striker');
  });

  it('COS-2 PRG-6 PRG-7 daily bonus and bot reward resolve to what was given', async () => {
    const store = makeStore();
    post.mockResolvedValueOnce({ data: { reward: 20, streak: 1, user: user({ coins: 20 }) } });
    expect((await store.dispatch(claimDailyBonus())).payload).toEqual({ coins: 20, streak: 1 });
    post.mockResolvedValueOnce({ data: { reward: 30, xp: 30, level: 2, levelCoins: 50, user: user({ coins: 100 }) } });
    expect((await store.dispatch(claimBotReward({ won: true, game: 'ludo' }))).payload)
      .toEqual({ coins: 30, xp: 30, level: 2, levelCoins: 50 });
    expect(post.mock.calls[1]?.slice(0, 2)).toEqual([`${API_BASE}/me/bot-reward`, { won: true, game: 'ludo' }]);
    expect(store.getState().auth.user?.coins).toBe(100);
  });
});
