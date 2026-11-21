import axios from 'axios';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { MatchView } from '@carrom/protocol';
import { API_BASE } from '@/constants/apiBase';
import { setToken } from '@/lib/auth';
import {
  dismissBotOffer, fetchLeaderboard, fetchMyMatches, formatDelta, formatWait, initialRankedState, myView,
  queueFailed, queueJoining, queueLeft, queueMessage, rankedReducer,
} from './rankedSlice';
import { makeStore } from './store';

vi.mock('axios', async (orig) => {
  const real = await orig<typeof import('axios')>();
  return { default: { ...real.default, get: vi.fn() } };
});
const get = vi.mocked(axios.get);

const match = (over: Partial<MatchView> = {}): MatchView => ({
  id: 'm1', game: 'carrom', ranked: true, winner: 'A', boards: 1, abandoned: false, createdAt: '2026-11-20T10:00:00.000Z',
  players: [
    { userId: 'me', name: 'Rina', seat: 0, team: 'A', ratingBefore: 1000, ratingAfter: 1016 },
    { userId: 'op', name: 'Sami', seat: 2, team: 'B', ratingBefore: 1000, ratingAfter: 984 },
  ],
  ...over,
});

describe('ranked slice', () => {
  afterEach(() => {
    get.mockReset();
    localStorage.clear();
  });

  it('RANK-8 queue: joining → status with timer and window → bot offer → matched → left', () => {
    let s = rankedReducer(initialRankedState(), queueJoining());
    expect(s.queue.status).toBe('joining');
    s = rankedReducer(s, queueMessage({ type: 'queue', waitedMs: 6200, window: 150, rating: 1040 }));
    expect(s.queue).toMatchObject({ status: 'queued', waitedMs: 6200, window: 150, rating: 1040, botOffer: false });
    s = rankedReducer(s, queueMessage({ type: 'botOffer' }));
    expect(s.queue.botOffer).toBe(true);
    s = rankedReducer(s, dismissBotOffer());
    expect(s.queue.botOffer).toBe(false);
    const reservation = { name: 'ranked', roomId: 'r', sessionId: 's', processId: 'p' };
    s = rankedReducer(s, queueMessage({ type: 'matched', reservation }));
    expect(s.queue.status).toBe('matched');
    s = rankedReducer(s, queueLeft());
    expect(s.queue).toEqual(initialRankedState().queue);
    s = rankedReducer(s, queueFailed({ status: 409, error: 'You are already in the queue' }));
    expect(s.queue).toMatchObject({ status: 'idle', error: { status: 409 } });
  });

  it('RANK-8 timer and rating-change text', () => {
    expect(formatWait(0)).toBe('0:00');
    expect(formatWait(65_400)).toBe('1:05');
    expect(formatDelta(1000, 1016)).toBe('+16');
    expect(formatDelta(1000, 984)).toBe('−16');
    expect(formatDelta(1000, 1000)).toBe('±0');
  });

  it('RANK-8 history row: my result, change and opponents', () => {
    expect(myView(match(), 'me')).toEqual({ won: true, delta: '+16', opponents: ['Sami'] });
    expect(myView(match(), 'op')).toEqual({ won: false, delta: '−16', opponents: ['Rina'] });
    expect(myView(match(), 'stranger')).toBeNull();
  });

  it('RANK-6 HAPP-2 leaderboard thunk sends the token and the game, stores players and my rank', async () => {
    setToken('tok');
    const me = { rank: 7, id: 'me', name: 'Rina', avatar: 1, rating: 1010 };
    get.mockResolvedValueOnce({ data: { players: [{ ...me, rank: 1 }], me } });
    const store = makeStore();
    await store.dispatch(fetchLeaderboard({ game: 'carrom', limit: 50 }));
    expect(get).toHaveBeenCalledWith(`${API_BASE}/leaderboard`, { headers: { Authorization: 'Bearer tok' }, params: { game: 'carrom', limit: 50 } });
    expect(store.getState().ranked.leaderboard).toMatchObject({ game: 'carrom', loading: false, me, error: null });
  });

  it('RANK-8 HAPP-6 match history thunk asks for one game; a failure keeps the error', async () => {
    setToken('tok');
    get.mockResolvedValueOnce({ data: { matches: [match()] } });
    const store = makeStore();
    await store.dispatch(fetchMyMatches('carrom'));
    expect(store.getState().ranked.matches.list).toHaveLength(1);
    expect(get).toHaveBeenLastCalledWith(`${API_BASE}/matches/me`, { headers: { Authorization: 'Bearer tok' }, params: { game: 'carrom' } });
    get.mockRejectedValueOnce(new Error('offline'));
    await store.dispatch(fetchMyMatches('carrom'));
    expect(store.getState().ranked.matches.error).toMatchObject({ status: 0 });
  });
});
