import { createAsyncThunk, createSlice, type PayloadAction } from '@reduxjs/toolkit';
import axios from 'axios';
import type { BlockRequest, IceResponse, MeResponse, PublicUser, ReportRequest } from '@carrom/protocol';
import { API_BASE } from '@/constants/apiBase';
import { getAuthHeaders } from '@/lib/auth';
import type { LinkState } from '@/lib/voice';
import { FALLBACK_ICE } from '@/lib/voice';
import { userUpdated } from './authSlice';

export interface VoiceState {
  /** VOICE-4 open mic: live after the player taps it (off at every room start). */
  micOn: boolean;
  /** Push-to-talk button held. */
  talking: boolean;
  /** VOICE-4 ranked / stranger room: this player tapped "Turn on voice". */
  optIn: boolean;
  /** VOICE-5 user ids muted for this player (this room only). */
  muted: string[];
  /** Session ids speaking now. */
  speaking: string[];
  /** Link state per other session. */
  links: Record<string, LinkState>;
  /** VOICE-8 no mic permission: the mic button stays off. */
  micDenied: boolean;
}

export const initialVoiceState = (): VoiceState => ({
  micOn: false, talking: false, optIn: false, muted: [], speaking: [], links: {}, micDenied: false,
});

/** A failed block/report: the server's message (or the network error). */
const failText = (err: unknown): string => {
  if (axios.isAxiosError<{ error?: unknown }>(err)) {
    const msg = err.response?.data?.error;
    return typeof msg === 'string' ? msg : err.message;
  }
  return err instanceof Error ? err.message : String(err);
};

/** VOICE-3 ICE servers for this room; STUN only when the server can't be asked. */
export async function fetchIceServers(): Promise<RTCIceServer[]> {
  try {
    const res = await axios.get<IceResponse>(`${API_BASE}/voice/ice`, { headers: getAuthHeaders() });
    return res.data.iceServers;
  } catch {
    return FALLBACK_ICE;
  }
}

/** VOICE-6 block a player for good (stored on the account). */
export const blockPlayer = createAsyncThunk<PublicUser, string, { rejectValue: string }>(
  'voice/block',
  async (userId, { dispatch, rejectWithValue }) => {
    try {
      const body: BlockRequest = { userId };
      const res = await axios.post<MeResponse>(`${API_BASE}/me/block`, body, { headers: getAuthHeaders() });
      dispatch(userUpdated(res.data.user));
      return res.data.user;
    } catch (err) {
      return rejectWithValue(failText(err));
    }
  },
);

/** VOICE-6 / ADDA-1 unblock a player again. */
export const unblockPlayer = createAsyncThunk<PublicUser, string, { rejectValue: string }>(
  'voice/unblock',
  async (userId, { dispatch, rejectWithValue }) => {
    try {
      const res = await axios.delete<MeResponse>(`${API_BASE}/me/block/${encodeURIComponent(userId)}`, { headers: getAuthHeaders() });
      dispatch(userUpdated(res.data.user));
      return res.data.user;
    } catch (err) {
      return rejectWithValue(failText(err));
    }
  },
);

/** VOICE-6 report a player met in this room. */
export const reportPlayer = createAsyncThunk<void, ReportRequest, { rejectValue: string }>(
  'voice/report',
  async (body, { rejectWithValue }) => {
    try {
      await axios.post(`${API_BASE}/reports`, body, { headers: getAuthHeaders() });
    } catch (err) {
      return rejectWithValue(failText(err));
    }
  },
);

const voiceSlice = createSlice({
  name: 'voice',
  initialState: initialVoiceState,
  reducers: {
    setMicOn: (s, a: PayloadAction<boolean>) => {
      s.micOn = a.payload;
      if (a.payload) s.micDenied = false;
    },
    setTalking: (s, a: PayloadAction<boolean>) => {
      s.talking = a.payload;
      if (a.payload) s.micDenied = false;
    },
    setOptIn: (s, a: PayloadAction<boolean>) => { s.optIn = a.payload; },
    toggleMuted: (s, a: PayloadAction<string>) => {
      s.muted = s.muted.includes(a.payload) ? s.muted.filter((u) => u !== a.payload) : [...s.muted, a.payload];
    },
    speakingChanged: (s, a: PayloadAction<string[]>) => { s.speaking = a.payload; },
    linksChanged: (s, a: PayloadAction<Record<string, LinkState>>) => { s.links = a.payload; },
    micDenied: (s) => {
      s.micDenied = true;
      s.micOn = false;
      s.talking = false;
    },
    /** Leaving the room: everything back to the defaults (mic off). */
    voiceReset: () => initialVoiceState(),
  },
});

export const {
  setMicOn, setTalking, setOptIn, toggleMuted, speakingChanged, linksChanged, micDenied, voiceReset,
} = voiceSlice.actions;
export const voiceReducer = voiceSlice.reducer;
