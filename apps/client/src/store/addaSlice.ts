import { createAsyncThunk, createSlice, isAnyOf } from '@reduxjs/toolkit';
import axios from 'axios';
import type {
  FriendRequestBody, FriendRequestResponse, FriendsResponse, GroupInvitePreview, GroupLeaderboardResponse, GroupPlayers,
  GroupReportRequest, GroupResponse, GroupsResponse, GroupSummary, GroupView, MatchesResponse, PlayerSummary, PresenceResponse,
  StartGroupRoomResponse, UpdateGroupRequest,
} from '@carrom/protocol';
import { API_BASE } from '@/constants/apiBase';
import { getAuthHeaders } from '@/lib/auth';

/** A failed call: HTTP status (0 = no answer) and the server's `error`. */
export interface AddaFailure { status: number; error: string }

export interface AddaState {
  friends: FriendsResponse | null;
  groups: GroupSummary[] | null;
  /** ADDA-3 the open group page. */
  group: GroupView | null;
  leaderboard: GroupLeaderboardResponse | null;
  /** ADDA-1 people from my recent online games (to add as friends). */
  recent: PlayerSummary[];
  loading: boolean;
  error: AddaFailure | null;
}

export const initialAddaState = (): AddaState =>
  ({ friends: null, groups: null, group: null, leaderboard: null, recent: [], loading: false, error: null });

export function addaFailure(err: unknown): AddaFailure {
  if (axios.isAxiosError<{ error?: unknown }>(err)) {
    const msg = err.response?.data?.error;
    return { status: err.response?.status ?? 0, error: typeof msg === 'string' ? msg : err.message };
  }
  return { status: 0, error: err instanceof Error ? err.message : String(err) };
}

type Method = 'get' | 'post' | 'patch' | 'delete';

/** One API call with the saved token; rejects with the server's `error`. */
function api<R, A>(type: string, method: Method, path: (a: A) => string, body?: (a: A) => unknown) {
  return createAsyncThunk<R, A, { rejectValue: AddaFailure }>(type, async (arg, { rejectWithValue }) => {
    try {
      const res = await axios.request<R>({
        method, url: `${API_BASE}${path(arg)}`, headers: getAuthHeaders(), data: body ? body(arg) : undefined,
      });
      return res.data;
    } catch (err) {
      return rejectWithValue(addaFailure(err));
    }
  });
}

const enc = encodeURIComponent;

// ---- ADDA-1 friends
export const fetchFriends = api<FriendsResponse, void>('adda/friends', 'get', () => '/friends');
export const sendFriendRequest = api<FriendRequestResponse, FriendRequestBody>('adda/request', 'post', () => '/friends/requests', (b) => b);
export const answerRequest = api<unknown, { userId: string; accept: boolean }>(
  'adda/answer', 'post', (a) => `/friends/${enc(a.userId)}/${a.accept ? 'accept' : 'decline'}`,
);
/** Unfriend, or take back a request. */
export const removeFriend = api<unknown, string>('adda/unfriend', 'delete', (id) => `/friends/${enc(id)}`);

/** ADDA-1 the other players of my recent games in these games, newest first, each once. */
export const fetchRecentPlayers = createAsyncThunk<PlayerSummary[], { me: string; games: readonly string[] }, { rejectValue: AddaFailure }>(
  'adda/recent',
  async ({ me, games }, { rejectWithValue }) => {
    try {
      const lists = await Promise.all(games.map((g) => axios.get<MatchesResponse>(
        `${API_BASE}/matches/me?game=${enc(g)}&limit=10`, { headers: getAuthHeaders() },
      )));
      const matches = lists.flatMap((r) => r.data.matches).sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
      const seen = new Map<string, PlayerSummary>();
      for (const m of matches) {
        for (const p of m.players) if (p.userId !== me && !seen.has(p.userId)) seen.set(p.userId, { id: p.userId, name: p.name, avatar: 0 });
      }
      return [...seen.values()].slice(0, 12);
    } catch (err) {
      return rejectWithValue(addaFailure(err));
    }
  },
);

// ---- ADDA-2 / ADDA-3 / ADDA-7 groups
export const fetchGroups = api<GroupsResponse, void>('adda/groups', 'get', () => '/groups');
export const createGroup = api<GroupResponse, string>('adda/createGroup', 'post', () => '/groups', (name) => ({ name }));
export const fetchGroup = api<GroupView, string>('adda/group', 'get', (id) => `/groups/${enc(id)}`);
export const fetchGroupLeaderboard = api<GroupLeaderboardResponse, { id: string; game: string }>(
  'adda/groupLeaderboard', 'get', (a) => `/groups/${enc(a.id)}/leaderboard?game=${enc(a.game)}`,
);
export const previewInvite = api<GroupInvitePreview, string>('adda/preview', 'get', (code) => `/groups/invite/${enc(code)}`);
export const joinGroup = api<GroupResponse, string>('adda/join', 'post', (code) => `/groups/join/${enc(code)}`);
export const leaveGroup = api<unknown, string>('adda/leave', 'post', (id) => `/groups/${enc(id)}/leave`);
export const removeMember = api<unknown, { id: string; userId: string }>(
  'adda/removeMember', 'delete', (a) => `/groups/${enc(a.id)}/members/${enc(a.userId)}`,
);
export const updateGroup = api<GroupResponse, { id: string } & UpdateGroupRequest>(
  'adda/updateGroup', 'patch', (a) => `/groups/${enc(a.id)}`, ({ id: _id, ...rest }) => rest,
);
export const startGroupRoom = api<StartGroupRoomResponse, { id: string; gameId: string; players: GroupPlayers }>(
  'adda/startRoom', 'post', (a) => `/groups/${enc(a.id)}/rooms`, (a) => ({ gameId: a.gameId, players: a.players }),
);
export const reportGroup = api<unknown, { id: string } & GroupReportRequest>(
  'adda/report', 'post', (a) => `/groups/${enc(a.id)}/report`, ({ id: _id, ...rest }) => rest,
);

// ---- ADDA-1 / ADDA-6 presence
export const beatPresence = api<PresenceResponse, string | null>('adda/presence', 'post', () => '/presence', (game) => ({ game }));

const addaSlice = createSlice({
  name: 'adda',
  initialState: initialAddaState,
  reducers: {
    clearAddaError(s) {
      s.error = null;
    },
  },
  extraReducers: (b) => {
    b.addCase(fetchFriends.fulfilled, (s, a) => { s.friends = a.payload; });
    b.addCase(fetchRecentPlayers.fulfilled, (s, a) => { s.recent = a.payload; });
    b.addCase(fetchGroups.fulfilled, (s, a) => { s.groups = a.payload.groups; });
    b.addCase(fetchGroup.pending, (s, a) => {
      if (s.group?.group.id !== a.meta.arg) Object.assign(s, { group: null, leaderboard: null });
    });
    b.addCase(fetchGroup.fulfilled, (s, a) => { s.group = a.payload; });
    b.addCase(fetchGroupLeaderboard.fulfilled, (s, a) => { s.leaderboard = a.payload; });
    b.addCase(updateGroup.fulfilled, (s, a) => {
      if (s.group?.group.id === a.payload.group.id) Object.assign(s.group.group, a.payload.group);
    });
    b.addCase(createGroup.fulfilled, (s, a) => { s.groups = [...(s.groups ?? []), a.payload.group]; });
    b.addCase(leaveGroup.fulfilled, (s, a) => {
      s.groups = (s.groups ?? []).filter((g) => g.id !== a.meta.arg);
      if (s.group?.group.id === a.meta.arg) s.group = null;
    });
    // Page loads and actions: one busy flag and the last error (presence beats stay quiet).
    const calls = [
      fetchFriends, sendFriendRequest, answerRequest, removeFriend, fetchGroups, createGroup, fetchGroup, joinGroup,
      leaveGroup, removeMember, updateGroup, startGroupRoom, reportGroup,
    ] as const;
    b.addMatcher(isAnyOf(...calls.map((c) => c.pending)), (s) => {
      s.loading = true;
      s.error = null;
    });
    b.addMatcher(isAnyOf(...calls.map((c) => c.fulfilled)), (s) => { s.loading = false; });
    b.addMatcher(isAnyOf(...calls.map((c) => c.rejected)), (s, a) => {
      s.loading = false;
      s.error = a.payload ?? { status: 0, error: a.error.message ?? '' };
    });
  },
});

export const { clearAddaError } = addaSlice.actions;
export const addaReducer = addaSlice.reducer;
