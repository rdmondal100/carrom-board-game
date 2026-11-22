import axios from 'axios';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { FriendsResponse, GroupView } from '@carrom/protocol';
import { API_BASE } from '@/constants/apiBase';
import { setToken } from '@/lib/auth';
import {
  createGroup, fetchFriends, fetchGroup, fetchRecentPlayers, joinGroup, leaveGroup, sendFriendRequest, updateGroup,
} from './addaSlice';
import { makeStore } from './store';

vi.mock('axios', async (orig) => {
  const real = await orig<typeof import('axios')>();
  return { default: { ...real.default, request: vi.fn(), get: vi.fn() } };
});
const req = vi.mocked(axios.request);
const get = vi.mocked(axios.get);

function httpError(status: number, error: string) {
  return new axios.AxiosError('Request failed', 'ERR_BAD_REQUEST', undefined, undefined,
    { status, data: { error }, statusText: '', headers: {}, config: {} as never });
}

const group = { id: 'g1', name: 'Adda', code: 'ABCDEFGH', role: 'owner' as const, members: 1, invitesLocked: false };

describe('ADDA addaSlice', () => {
  beforeEach(() => {
    localStorage.clear();
    setToken('tok');
    vi.clearAllMocks();
  });

  it('ADDA-1 friends load with the token; a request posts the code', async () => {
    const store = makeStore();
    const data: FriendsResponse = { code: 'ABCDEFGH', friends: [], incoming: [], outgoing: [], blocked: [] };
    req.mockResolvedValueOnce({ data });
    await store.dispatch(fetchFriends());
    expect(req).toHaveBeenCalledWith({ method: 'get', url: `${API_BASE}/friends`, headers: { Authorization: 'Bearer tok' }, data: undefined });
    expect(store.getState().adda.friends).toEqual(data);

    req.mockResolvedValueOnce({ data: { status: 'sent' } });
    await store.dispatch(sendFriendRequest({ code: 'WXYZ2345' }));
    expect(req).toHaveBeenLastCalledWith(expect.objectContaining({ method: 'post', url: `${API_BASE}/friends/requests`, data: { code: 'WXYZ2345' } }));
  });

  it('ADDA-1 a refused call keeps the server\'s message', async () => {
    const store = makeStore();
    req.mockRejectedValueOnce(httpError(403, "You can't add this player"));
    const r = await store.dispatch(sendFriendRequest({ userId: 'u2' }));
    expect(r.payload).toEqual({ status: 403, error: "You can't add this player" });
    expect(store.getState().adda).toMatchObject({ loading: false, error: { status: 403 } });
  });

  it('ADDA-2 create, join by code, lock and leave keep the lists in step', async () => {
    const store = makeStore();
    req.mockResolvedValueOnce({ data: { group } });
    await store.dispatch(createGroup('Adda'));
    expect(req).toHaveBeenLastCalledWith(expect.objectContaining({ url: `${API_BASE}/groups`, data: { name: 'Adda' } }));
    expect(store.getState().adda.groups).toEqual([group]);

    req.mockResolvedValueOnce({ data: { group: { ...group, role: 'member' } } });
    await store.dispatch(joinGroup('ABCDEFGH'));
    expect(req).toHaveBeenLastCalledWith(expect.objectContaining({ method: 'post', url: `${API_BASE}/groups/join/ABCDEFGH` }));

    const view: GroupView = { group: { ...group, ownerId: 'u1' }, members: [], matches: [] };
    req.mockResolvedValueOnce({ data: view });
    await store.dispatch(fetchGroup('g1'));
    req.mockResolvedValueOnce({ data: { group: { ...group, invitesLocked: true } } });
    await store.dispatch(updateGroup({ id: 'g1', invitesLocked: true }));
    expect(req).toHaveBeenLastCalledWith(expect.objectContaining({ method: 'patch', data: { invitesLocked: true } }));
    expect(store.getState().adda.group?.group.invitesLocked).toBe(true);

    req.mockResolvedValueOnce({ data: { ok: true } });
    await store.dispatch(leaveGroup('g1'));
    expect(store.getState().adda.groups).toEqual([]);
    expect(store.getState().adda.group).toBeNull();
  });

  it('ADDA-1 recent players: other players of my recent games, newest first, each once', async () => {
    const store = makeStore();
    const match = (createdAt: string, ...names: [string, string][]) => ({
      id: createdAt, game: 'carrom', ranked: false, winner: 'A', boards: 1, abandoned: false, createdAt,
      players: names.map(([userId, name], seat) => ({ userId, name, seat, team: 'A', ratingBefore: 1000, ratingAfter: 1000 })),
    });
    get.mockResolvedValueOnce({ data: { matches: [match('2026-11-01', ['me', 'Me'], ['b', 'Bina'])] } });
    get.mockResolvedValueOnce({ data: { matches: [match('2026-11-05', ['me', 'Me'], ['c', 'Cara'], ['b', 'Bina'])] } });
    await store.dispatch(fetchRecentPlayers({ me: 'me', games: ['carrom', 'ludo'] }));
    expect(store.getState().adda.recent.map((p) => p.name)).toEqual(['Cara', 'Bina']);
  });
});
