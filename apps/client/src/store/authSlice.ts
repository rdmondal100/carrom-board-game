import { createAsyncThunk, createSlice, isAnyOf, type PayloadAction } from '@reduxjs/toolkit';
import axios from 'axios';
import type {
  AuthResponse, GuestRequest, LoginRequest, MeResponse, PublicUser, RegisterRequest, UpdateMeRequest,
} from '@carrom/protocol';
import { API_BASE } from '@/constants/apiBase';
import { clearToken, getAuthHeaders, getToken, setToken } from '@/lib/auth';

export type AuthAction = 'guest' | 'register' | 'login' | 'google' | 'loadMe' | 'updateMe';

/** A failed call: HTTP status (0 = no answer) and the server's `error`. */
export interface AuthFailure {
  action: AuthAction;
  status: number;
  error: string;
}

export interface AuthState {
  user: PublicUser | null;
  /** A call is in flight. */
  loading: boolean;
  /** The saved token has been checked with /auth/me (or there was none). */
  checked: boolean;
  error: AuthFailure | null;
}

export const initialAuthState = (): AuthState =>
  ({ user: null, loading: false, checked: getToken() === null, error: null });

const url = (path: string) => `${API_BASE}/auth/${path}`;

function failure(action: AuthAction, err: unknown): AuthFailure {
  if (axios.isAxiosError<{ error?: unknown }>(err)) {
    const status = err.response?.status ?? 0;
    const msg = err.response?.data?.error;
    return { action, status, error: typeof msg === 'string' ? msg : err.message };
  }
  return { action, status: 0, error: err instanceof Error ? err.message : String(err) };
}

/** A thunk that answers with a token + user saves the token, then hands back the user. */
function tokenThunk<A>(action: AuthAction, path: string) {
  return createAsyncThunk<PublicUser, A, { rejectValue: AuthFailure }>(
    `auth/${action}`,
    async (body, { rejectWithValue }) => {
      try {
        const res = await axios.post<AuthResponse>(url(path), body ?? {}, { headers: getAuthHeaders() });
        setToken(res.data.token);
        return res.data.user;
      } catch (err) {
        return rejectWithValue(failure(action, err));
      }
    },
  );
}

/** AUTH-2: play at once as a guest. */
export const guestLogin = tokenThunk<GuestRequest | undefined>('guest', 'guest');
/** AUTH-3: register; when a guest is signed in the server upgrades that guest. */
export const registerUser = tokenThunk<RegisterRequest>('register', 'register');
/** AUTH-4 */
export const loginUser = tokenThunk<LoginRequest>('login', 'login');
/** AUTH-5: `idToken` from Google's button. */
export const googleLogin = tokenThunk<{ idToken: string }>('google', 'google');

/** AUTH-6: who the saved token belongs to. A 401 forgets the token. */
export const loadMe = createAsyncThunk<PublicUser, void, { rejectValue: AuthFailure }>(
  'auth/loadMe',
  async (_, { rejectWithValue }) => {
    try {
      const res = await axios.get<MeResponse>(url('me'), { headers: getAuthHeaders() });
      return res.data.user;
    } catch (err) {
      const f = failure('loadMe', err);
      if (f.status === 401) clearToken();
      return rejectWithValue(f);
    }
  },
);

/** AUTH-6: change name and/or avatar. */
export const updateMe = createAsyncThunk<PublicUser, UpdateMeRequest, { rejectValue: AuthFailure }>(
  'auth/updateMe',
  async (body, { rejectWithValue }) => {
    try {
      const res = await axios.patch<MeResponse>(url('me'), body, { headers: getAuthHeaders() });
      return res.data.user;
    } catch (err) {
      return rejectWithValue(failure('updateMe', err));
    }
  },
);

export const logout = createAsyncThunk('auth/logout', () => {
  clearToken();
});

const signIns = [guestLogin, registerUser, loginUser, googleLogin, loadMe, updateMe] as const;

const authSlice = createSlice({
  name: 'auth',
  initialState: initialAuthState,
  reducers: {
    clearAuthError: (s) => { s.error = null; },
    /** COS-2..4: the server sent the user back after a purchase, equip or reward. */
    userUpdated: (s, a: PayloadAction<PublicUser>) => { s.user = a.payload; },
  },
  extraReducers: (b) => {
    b.addCase(logout.fulfilled, () => ({ ...initialAuthState(), checked: true }));
    b.addMatcher(isAnyOf(...signIns.map((t) => t.pending)), (s) => {
      s.loading = true;
      s.error = null;
    });
    b.addMatcher(isAnyOf(...signIns.map((t) => t.fulfilled)), (s, a) => {
      s.loading = false;
      s.checked = true;
      s.user = a.payload;
    });
    b.addMatcher(isAnyOf(...signIns.map((t) => t.rejected)), (s, a) => {
      s.loading = false;
      s.checked = true;
      const f = a.payload ?? { action: 'loadMe', status: 0, error: a.error.message ?? 'Request failed' };
      s.error = f;
      // A dead token means nobody is signed in; any other loadMe failure keeps the user.
      if (f.action === 'loadMe' && f.status === 401) s.user = null;
    });
  },
});

export const { clearAuthError, userUpdated } = authSlice.actions;
export const authReducer = authSlice.reducer;

/** The i18n key for a failure we can say better than the server, else null (show `error`). */
export function authErrorKey(f: AuthFailure): string | null {
  if (f.status === 0) return 'auth.err.network';
  if (f.status === 429) return 'auth.err.rateLimit';
  if (f.status === 409) return 'auth.err.emailTaken';
  if (f.action === 'login' && f.status === 401) return 'auth.err.badLogin';
  if (f.action === 'google' && f.status === 401) return 'auth.err.google';
  if (f.action === 'google' && f.status === 503) return 'auth.err.googleOff';
  if (f.status >= 500) return 'auth.err.server';
  return null;
}
