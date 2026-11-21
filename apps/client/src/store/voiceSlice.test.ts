import axios from 'axios';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { LobbyView, PlayerView, PublicUser } from '@carrom/protocol';
import { DEFAULT_SLOTS } from '@carrom/protocol';
import { voiceOpenIn } from '@/components/VoiceController';
import { rms } from '@/lib/voiceLevel';
import { makeStore } from './store';
import { blockPlayer, fetchIceServers, micDenied, reportPlayer, setMicOn, toggleMuted, voiceReset } from './voiceSlice';

vi.mock('axios', async (orig) => {
  const real = await orig<typeof import('axios')>();
  return { default: { ...real.default, post: vi.fn(), get: vi.fn() } };
});
const post = vi.mocked(axios.post);
const get = vi.mocked(axios.get);

const user = (blocked: string[]): PublicUser => ({
  id: 'u1', name: 'Rina', email: null, isGuest: true, hasPassword: false, hasGoogle: false, avatar: 0, rating: 1000,
  ratings: {}, coins: 0, cosmetics: { equipped: { ...DEFAULT_SLOTS }, owned: [] }, blocked, createdAt: '2026-11-21T00:00:00.000Z',
});

beforeEach(() => {
  post.mockReset();
  get.mockReset();
});

describe('voice slice', () => {
  it('VOICE-6 block stores the returned user (blocked list) in auth', async () => {
    const store = makeStore();
    post.mockResolvedValueOnce({ data: { user: user(['u9']) } });
    const r = await store.dispatch(blockPlayer('u9'));
    expect(blockPlayer.fulfilled.match(r)).toBe(true);
    expect(post.mock.calls[0]![0]).toMatch(/\/me\/block$/);
    expect(post.mock.calls[0]![1]).toEqual({ userId: 'u9' });
    expect(store.getState().auth.user?.blocked).toEqual(['u9']);
  });

  it('VOICE-6 report sends userId, matchId and reason', async () => {
    const store = makeStore();
    post.mockResolvedValueOnce({ data: { ok: true } });
    await store.dispatch(reportPlayer({ userId: 'u9', matchId: 'room1', reason: 'abuse' }));
    expect(post.mock.calls[0]![0]).toMatch(/\/reports$/);
    expect(post.mock.calls[0]![1]).toEqual({ userId: 'u9', matchId: 'room1', reason: 'abuse' });
    post.mockRejectedValueOnce(Object.assign(new axios.AxiosError('x'), { response: { status: 400, data: { error: 'nope' } } }));
    const r = await store.dispatch(reportPlayer({ userId: 'u9', matchId: 'room1', reason: 'abuse' }));
    expect(r.payload).toBe('nope');
  });

  it('VOICE-4 mic starts off; a denied mic turns it off; leaving the room resets', () => {
    const store = makeStore();
    expect(store.getState().voice.micOn).toBe(false);
    store.dispatch(setMicOn(true));
    store.dispatch(toggleMuted('u2'));
    expect(store.getState().voice).toMatchObject({ micOn: true, muted: ['u2'] });
    store.dispatch(micDenied());
    expect(store.getState().voice).toMatchObject({ micOn: false, micDenied: true });
    store.dispatch(voiceReset());
    expect(store.getState().voice).toMatchObject({ micOn: false, micDenied: false, muted: [] });
  });

  it('VOICE-3 ICE servers from the API; STUN when it fails (VOICE-8)', async () => {
    get.mockResolvedValueOnce({ data: { iceServers: [{ urls: ['turn:t'], username: 'a', credential: 'b' }], ttl: 3600 } });
    expect(await fetchIceServers()).toEqual([{ urls: ['turn:t'], username: 'a', credential: 'b' }]);
    get.mockRejectedValueOnce(new Error('offline'));
    expect(await fetchIceServers()).toEqual([{ urls: ['stun:stun.l.google.com:19302'] }]);
  });

  it('VOICE-4 voice is open in a private room, in ranked only when both opted in', () => {
    const p = (id: string, voiceOn: boolean): PlayerView => ({
      sessionId: id, userId: id, name: id, avatar: 0, seat: 0, ready: true, bot: false, left: false, rematch: false,
      striker: '', coinSet: '', voiceOn, voiceMuted: true,
    });
    const lobby = (ranked: boolean, a: boolean, b: boolean): LobbyView => ({
      code: '', phase: 'playing', gameId: 'carrom', config: '{}', hostId: '', ranked, players: { a: p('a', a), b: p('b', b) },
    });
    expect(voiceOpenIn(lobby(false, true, false))).toBe(true);
    expect(voiceOpenIn(lobby(true, true, false))).toBe(false);
    expect(voiceOpenIn(lobby(true, true, true))).toBe(true);
  });

  it('VOICE-5 level meter: silence is 0, a loud signal is above the speaking line', () => {
    expect(rms(new Uint8Array(64).fill(128))).toBe(0);
    expect(rms(Uint8Array.from({ length: 64 }, (_, i) => (i % 2 ? 200 : 56)))).toBeGreaterThan(0.5);
  });
});
