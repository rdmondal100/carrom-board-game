import axios from 'axios';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_SLOTS, type ProgressResponse, type PublicUser } from '@carrom/protocol';
import { API_BASE } from '@/constants/apiBase';
import { logout } from './authSlice';
import { claimMission, fetchProgress, swapMission } from './progressSlice';
import { makeStore } from './store';

vi.mock('axios', async (orig) => {
  const real = await orig<typeof import('axios')>();
  return { default: { ...real.default, post: vi.fn(), get: vi.fn() } };
});
const post = vi.mocked(axios.post);
const get = vi.mocked(axios.get);

const user = (coins: number): PublicUser => ({
  id: 'u1', name: 'Rina', email: null, isGuest: true, hasPassword: false, hasGoogle: false,
  avatar: 0, rating: 1000, ratings: {}, xp: 0, level: 1, coins,
  cosmetics: { equipped: { ...DEFAULT_SLOTS }, owned: [] }, blocked: [], createdAt: '2026-11-20T00:00:00.000Z',
});

const progress = (over: Partial<ProgressResponse> = {}): ProgressResponse => ({
  day: '2026-11-26', xp: 0, level: 1, levelXp: 0, levelNeed: 100,
  streak: { count: 1, day: 1, claimedToday: true },
  missions: [{ id: 'win-any', kind: 'win', game: null, target: 2, coins: 60, xp: 40, progress: 2, claimed: false }],
  swapsLeft: 1, user: user(0), ...over,
});

describe('progress slice', () => {
  beforeEach(() => vi.clearAllMocks());

  it('PRG-7 fetch keeps the progress and puts the user in auth', async () => {
    const store = makeStore();
    get.mockResolvedValueOnce({ data: progress({ user: user(7) }) });
    await store.dispatch(fetchProgress());
    expect(get.mock.calls[0]?.[0]).toBe(`${API_BASE}/me/progress`);
    expect(store.getState().progress.data?.missions[0]?.id).toBe('win-any');
    expect(store.getState().progress.data).not.toHaveProperty('user');
    expect(store.getState().auth.user?.coins).toBe(7);
  });

  it('PRG-4 claim posts to the mission and resolves with the reward; PRG-5 swap too', async () => {
    const store = makeStore();
    post.mockResolvedValueOnce({ data: progress({ reward: { coins: 60, xp: 40 }, user: user(60) }) });
    const r = await store.dispatch(claimMission(0));
    expect(post.mock.calls[0]?.[0]).toBe(`${API_BASE}/me/missions/0/claim`);
    expect((r.payload as ProgressResponse).reward).toEqual({ coins: 60, xp: 40 });
    expect(store.getState().progress.busy).toBeNull();
    expect(store.getState().auth.user?.coins).toBe(60);
    post.mockResolvedValueOnce({ data: progress({ swapsLeft: 0 }) });
    await store.dispatch(swapMission(0));
    expect(post.mock.calls[1]?.[0]).toBe(`${API_BASE}/me/missions/0/swap`);
    expect(store.getState().progress.data?.swapsLeft).toBe(0);
  });

  it('PRG-7 a failed claim keeps the error; signing out clears progress', async () => {
    const store = makeStore();
    get.mockResolvedValueOnce({ data: progress() });
    await store.dispatch(fetchProgress());
    post.mockRejectedValueOnce(Object.assign(new Error('409'), {
      isAxiosError: true, response: { status: 409, data: { error: 'Mission already claimed' } },
    }));
    await store.dispatch(claimMission(0));
    expect(store.getState().progress.error).toEqual({ status: 409, error: 'Mission already claimed' });
    await store.dispatch(logout());
    expect(store.getState().progress.data).toBeNull();
  });
});
