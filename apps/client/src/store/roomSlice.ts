import { createAsyncThunk, createSlice, isAnyOf, type PayloadAction } from '@reduxjs/toolkit';
import axios from 'axios';
import type { CreateRoomOptions, LobbyView, RoomLookupResponse } from '@carrom/protocol';
import { API_BASE } from '@/constants/apiBase';
import {
  createGameRoom, currentLobby, joinGameRoom, leaveGameRoom, resumeGameRoom,
} from '@/lib/colyseus';

/** A failed create/join: HTTP-like status (0 = no answer) and the server's message. */
export interface RoomFailure { status: number; error: string }

export interface RoomState {
  /** ROOM-3 synced lobby (null when not in a room). */
  lobby: LobbyView | null;
  sessionId: string | null;
  connecting: boolean;
  error: RoomFailure | null;
}

export const initialRoomState = (): RoomState => ({ lobby: null, sessionId: null, connecting: false, error: null });

interface Joined { sessionId: string; lobby: LobbyView | null }

export function roomFailure(err: unknown): RoomFailure {
  if (axios.isAxiosError<{ error?: unknown }>(err)) {
    const msg = err.response?.data?.error;
    return { status: err.response?.status ?? 0, error: typeof msg === 'string' ? msg : err.message };
  }
  const e = err as { code?: unknown; message?: unknown };
  return {
    status: typeof e?.code === 'number' && e.code >= 400 && e.code < 600 ? e.code : 0,
    error: typeof e?.message === 'string' ? e.message : String(err),
  };
}

const joined = (r: { sessionId: string }): Joined => ({ sessionId: r.sessionId, lobby: currentLobby() });

/** ROOM-1: create a room with these settings and sit in it. */
export const createRoom = createAsyncThunk<Joined, CreateRoomOptions, { rejectValue: RoomFailure }>(
  'room/create',
  async (opts, { rejectWithValue }) => {
    try {
      return joined(await createGameRoom(opts));
    } catch (err) {
      return rejectWithValue(roomFailure(err));
    }
  },
);

/** ROOM-1: look the code up, then join that room. */
export const joinByCode = createAsyncThunk<Joined, string, { rejectValue: RoomFailure }>(
  'room/join',
  async (code, { rejectWithValue }) => {
    try {
      const res = await axios.get<RoomLookupResponse>(`${API_BASE}/rooms/${encodeURIComponent(code)}`);
      return joined(await joinGameRoom(res.data.roomId));
    } catch (err) {
      return rejectWithValue(roomFailure(err));
    }
  },
);

/** ROOM-8: rejoin after a reload; rejects quietly (status 0) when there is nothing to rejoin. */
export const resumeRoom = createAsyncThunk<Joined, void, { rejectValue: RoomFailure }>(
  'room/resume',
  async (_, { rejectWithValue }) => {
    const r = await resumeGameRoom();
    return r ? joined(r) : rejectWithValue({ status: 0, error: '' });
  },
);

export const leaveRoom = createAsyncThunk('room/leave', async () => {
  await leaveGameRoom();
});

const roomSlice = createSlice({
  name: 'room',
  initialState: initialRoomState,
  reducers: {
    /** Every synced lobby change (null once the room is gone). */
    lobbyChanged(s, a: PayloadAction<LobbyView | null>) {
      s.lobby = a.payload;
      if (a.payload === null) s.sessionId = null;
    },
    clearRoomError(s) {
      s.error = null;
    },
  },
  extraReducers: (b) => {
    b.addCase(leaveRoom.fulfilled, () => initialRoomState());
    b.addMatcher(isAnyOf(createRoom.pending, joinByCode.pending, resumeRoom.pending), (s) => {
      s.connecting = true;
      s.error = null;
    });
    b.addMatcher(isAnyOf(createRoom.fulfilled, joinByCode.fulfilled, resumeRoom.fulfilled), (s, a) => {
      s.connecting = false;
      s.sessionId = a.payload.sessionId;
      s.lobby = a.payload.lobby ?? s.lobby;
    });
    b.addMatcher(isAnyOf(createRoom.rejected, joinByCode.rejected, resumeRoom.rejected), (s, a) => {
      s.connecting = false;
      const f = a.payload ?? { status: 0, error: a.error.message ?? '' };
      s.error = f.error === '' ? null : f;
    });
  },
});

export const { lobbyChanged, clearRoomError } = roomSlice.actions;
export const roomReducer = roomSlice.reducer;

/** i18n key for a failure the player can act on; null = show the server's text. */
export function roomErrorKey(f: RoomFailure): string | null {
  if (f.status === 404) return 'online.err.notFound';
  if (f.status === 401) return 'online.err.signIn';
  if (f.status === 409) return 'online.err.closed';
  if (f.status === 0) return 'online.err.network';
  return null;
}
