import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import axios from 'axios';
import type { ProgressResponse } from '@carrom/protocol';
import { API_BASE } from '@/constants/apiBase';
import { getAuthHeaders } from '@/lib/auth';
import { logout, userUpdated } from './authSlice';

/** PRG-7 what the progress cards show: the server's answer without the user (that lives in auth). */
export type ProgressData = Omit<ProgressResponse, 'user' | 'reward'>;

/** A failed call: HTTP status (0 = no answer) and the server's `error`. */
export interface ProgressFailure { status: number; error: string }

export interface ProgressState {
  data: ProgressData | null;
  /** The mission index being claimed or swapped, or null. */
  busy: number | null;
  error: ProgressFailure | null;
}

export const initialProgressState = (): ProgressState => ({ data: null, busy: null, error: null });

function failure(err: unknown): ProgressFailure {
  if (axios.isAxiosError<{ error?: unknown }>(err)) {
    const msg = err.response?.data?.error;
    return { status: err.response?.status ?? 0, error: typeof msg === 'string' ? msg : err.message };
  }
  return { status: 0, error: err instanceof Error ? err.message : String(err) };
}

type Cfg = { rejectValue: ProgressFailure };

/** Keep the user (coins, XP) in auth; return the rest. */
function split(res: ProgressResponse, dispatch: (a: unknown) => unknown): ProgressResponse {
  dispatch(userUpdated(res.user));
  return res;
}

/** PRG-7 level, streak and today's missions. */
export const fetchProgress = createAsyncThunk<ProgressResponse, void, Cfg>('progress/fetch', async (_, { dispatch, rejectWithValue }) => {
  try {
    const res = await axios.get<ProgressResponse>(`${API_BASE}/me/progress`, { headers: getAuthHeaders() });
    return split(res.data, dispatch);
  } catch (err) {
    return rejectWithValue(failure(err));
  }
});

/** PRG-4 claim a finished mission; the answer carries `reward` (coins, XP, any level-up). */
export const claimMission = createAsyncThunk<ProgressResponse, number, Cfg>('progress/claim', async (index, { dispatch, rejectWithValue }) => {
  try {
    const res = await axios.post<ProgressResponse>(`${API_BASE}/me/missions/${index}/claim`, {}, { headers: getAuthHeaders() });
    return split(res.data, dispatch);
  } catch (err) {
    return rejectWithValue(failure(err));
  }
});

/** PRG-5 swap one mission for another (once a day). */
export const swapMission = createAsyncThunk<ProgressResponse, number, Cfg>('progress/swap', async (index, { dispatch, rejectWithValue }) => {
  try {
    const res = await axios.post<ProgressResponse>(`${API_BASE}/me/missions/${index}/swap`, {}, { headers: getAuthHeaders() });
    return split(res.data, dispatch);
  } catch (err) {
    return rejectWithValue(failure(err));
  }
});

function dataOf(res: ProgressResponse): ProgressData {
  const { day, xp, level, levelXp, levelNeed, streak, missions, swapsLeft } = res;
  return { day, xp, level, levelXp, levelNeed, streak, missions, swapsLeft };
}

const progressSlice = createSlice({
  name: 'progress',
  initialState: initialProgressState,
  reducers: {},
  extraReducers: (b) => {
    b.addCase(fetchProgress.fulfilled, (s, a) => { s.data = dataOf(a.payload); s.error = null; });
    b.addCase(fetchProgress.rejected, (s, a) => { s.error = a.payload ?? { status: 0, error: a.error.message ?? 'Request failed' }; });
    for (const thunk of [claimMission, swapMission]) {
      b.addCase(thunk.pending, (s, a) => { s.busy = a.meta.arg; s.error = null; });
      b.addCase(thunk.fulfilled, (s, a) => { s.busy = null; s.data = dataOf(a.payload); });
      b.addCase(thunk.rejected, (s, a) => {
        s.busy = null;
        s.error = a.payload ?? { status: 0, error: a.error.message ?? 'Request failed' };
      });
    }
    // Another account must never see these missions.
    b.addCase(logout.fulfilled, () => initialProgressState());
  },
});

export const progressReducer = progressSlice.reducer;
