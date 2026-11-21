import { createAsyncThunk, createSlice, type PayloadAction } from '@reduxjs/toolkit';
import axios from 'axios';
import type {
  LeaderboardEntry, LeaderboardResponse, MatchesResponse, MatchView, QueueMessage,
} from '@carrom/protocol';
import { API_BASE } from '@/constants/apiBase';
import { getAuthHeaders } from '@/lib/auth';
import { roomFailure, type RoomFailure } from './roomSlice';

export type QueueStatus = 'idle' | 'joining' | 'queued' | 'matched';

export interface QueueState {
  status: QueueStatus;
  /** Time waited, as the server last said. */
  waitedMs: number;
  /** RANK-2 current ± rating window. */
  window: number;
  rating: number;
  /** RANK-3 the server offered a bot game. */
  botOffer: boolean;
  error: RoomFailure | null;
}

export interface RankedState {
  queue: QueueState;
  /** HAPP-2 `game` = the game the list is for. */
  leaderboard: { game: string; players: LeaderboardEntry[]; me: LeaderboardEntry | null; loading: boolean; error: RoomFailure | null };
  /** HAPP-6 `game` = the game the list is for. */
  matches: { game: string; list: MatchView[]; loading: boolean; error: RoomFailure | null };
}

const idleQueue = (): QueueState => ({ status: 'idle', waitedMs: 0, window: 0, rating: 0, botOffer: false, error: null });

export const initialRankedState = (): RankedState => ({
  queue: idleQueue(),
  leaderboard: { game: '', players: [], me: null, loading: false, error: null },
  matches: { game: '', list: [], loading: false, error: null },
});

/** RANK-6 / HAPP-2: one game's top players (and my rank when signed in). */
export const fetchLeaderboard = createAsyncThunk<LeaderboardResponse, { game: string; limit?: number }, { rejectValue: RoomFailure }>(
  'ranked/leaderboard',
  async ({ game, limit }, { rejectWithValue }) => {
    try {
      const res = await axios.get<LeaderboardResponse>(`${API_BASE}/leaderboard`, {
        headers: getAuthHeaders(), params: limit === undefined ? { game } : { game, limit },
      });
      return res.data;
    } catch (err) {
      return rejectWithValue(roomFailure(err));
    }
  },
);

/** RANK-8 / HAPP-6: my recent games of one game for the Profile page. */
export const fetchMyMatches = createAsyncThunk<MatchView[], string, { rejectValue: RoomFailure }>(
  'ranked/matches',
  async (game, { rejectWithValue }) => {
    try {
      const res = await axios.get<MatchesResponse>(`${API_BASE}/matches/me`, { headers: getAuthHeaders(), params: { game } });
      return res.data.matches;
    } catch (err) {
      return rejectWithValue(roomFailure(err));
    }
  },
);

const rankedSlice = createSlice({
  name: 'ranked',
  initialState: initialRankedState,
  reducers: {
    queueJoining(s) {
      s.queue = { ...idleQueue(), status: 'joining' };
    },
    /** Every message from the queue room. */
    queueMessage(s, a: PayloadAction<QueueMessage>) {
      const m = a.payload;
      if (m.type === 'queue') Object.assign(s.queue, { status: 'queued', waitedMs: m.waitedMs, window: m.window, rating: m.rating });
      else if (m.type === 'botOffer') s.queue.botOffer = true;
      else if (m.type === 'matched') s.queue.status = 'matched';
      else s.queue.error = { status: 0, error: m.message };
    },
    /** RANK-3 "keep waiting": hide the bot offer (the server offers it only once). */
    dismissBotOffer(s) {
      s.queue.botOffer = false;
    },
    queueFailed(s, a: PayloadAction<RoomFailure>) {
      s.queue = { ...idleQueue(), error: a.payload };
    },
    /** Left the queue (cancel, bot game, or matched and gone to the game). */
    queueLeft(s) {
      s.queue = idleQueue();
    },
  },
  extraReducers: (b) => {
    b.addCase(fetchLeaderboard.pending, (s, a) => {
      // Another game's rows must not show under this game's title.
      if (s.leaderboard.game !== a.meta.arg.game) Object.assign(s.leaderboard, { game: a.meta.arg.game, players: [], me: null });
      s.leaderboard.loading = true;
      s.leaderboard.error = null;
    });
    b.addCase(fetchLeaderboard.fulfilled, (s, a) => {
      if (a.meta.arg.game !== s.leaderboard.game) return;
      s.leaderboard = { game: a.meta.arg.game, players: a.payload.players, me: a.payload.me, loading: false, error: null };
    });
    b.addCase(fetchLeaderboard.rejected, (s, a) => {
      s.leaderboard.loading = false;
      s.leaderboard.error = a.payload ?? { status: 0, error: a.error.message ?? '' };
    });
    b.addCase(fetchMyMatches.pending, (s, a) => {
      if (s.matches.game !== a.meta.arg) Object.assign(s.matches, { game: a.meta.arg, list: [] });
      s.matches.loading = true;
      s.matches.error = null;
    });
    b.addCase(fetchMyMatches.fulfilled, (s, a) => {
      if (a.meta.arg !== s.matches.game) return;
      s.matches = { game: a.meta.arg, list: a.payload, loading: false, error: null };
    });
    b.addCase(fetchMyMatches.rejected, (s, a) => {
      s.matches.loading = false;
      s.matches.error = a.payload ?? { status: 0, error: a.error.message ?? '' };
    });
  },
});

export const { dismissBotOffer, queueJoining, queueMessage, queueFailed, queueLeft } = rankedSlice.actions;
export const rankedReducer = rankedSlice.reducer;

/** Whole seconds as m:ss. */
export function formatWait(ms: number): string {
  const total = Math.floor(Math.max(0, ms) / 1000);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

/** "+16", "−16", "±0" for a rating change. */
export function formatDelta(before: number, after: number): string {
  const d = after - before;
  return d > 0 ? `+${d}` : d < 0 ? `−${-d}` : '±0';
}

/** RANK-8: my side of a finished match: won?, rating change, opponents' names. */
export function myView(m: MatchView, userId: string): { won: boolean; delta: string; opponents: string[] } | null {
  const me = m.players.find((p) => p.userId === userId);
  if (!me) return null;
  return {
    won: me.team === m.winner,
    delta: formatDelta(me.ratingBefore, me.ratingAfter),
    opponents: m.players.filter((p) => p.team !== me.team).map((p) => p.name),
  };
}
