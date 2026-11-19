import axios from 'axios';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PublicUser } from '@carrom/protocol';
import { API_BASE } from '@/constants/apiBase';
import { getAuthHeaders, getToken, setToken, TOKEN_KEY } from '@/lib/auth';
import {
  authErrorKey, authReducer, googleLogin, guestLogin, initialAuthState, loadMe, loginUser, logout,
  registerUser, updateMe, type AuthFailure, type AuthState,
} from './authSlice';
import { makeStore } from './store';

vi.mock('axios', async (orig) => {
  const real = await orig<typeof import('axios')>();
  return { default: { ...real.default, post: vi.fn(), get: vi.fn(), patch: vi.fn() } };
});
const post = vi.mocked(axios.post);
const get = vi.mocked(axios.get);

const user = (over: Partial<PublicUser> = {}): PublicUser => ({
  id: 'u1', name: 'Rina', email: null, isGuest: true, hasPassword: false, hasGoogle: false,
  avatar: 0, rating: 1000, coins: 0, cosmetics: { equipped: [], owned: [] }, createdAt: '2026-11-20T00:00:00.000Z',
  ...over,
});

/** An axios-style HTTP error. */
function httpError(status: number, error: string) {
  return new axios.AxiosError('Request failed', 'ERR_BAD_REQUEST', undefined, undefined,
    { status, data: { error }, statusText: '', headers: {}, config: {} as never });
}

const start = (over: Partial<AuthState> = {}): AuthState => ({ ...initialAuthState(), ...over });
const fail = (f: AuthFailure) => f;

describe('authSlice reducers', () => {
  beforeEach(() => localStorage.clear());

  it('AUTH-9 pending sets loading and clears the last error', () => {
    const s = authReducer(start({ error: fail({ action: 'login', status: 401, error: 'x' }) }),
      { type: loginUser.pending.type });
    expect(s).toMatchObject({ loading: true, error: null });
  });

  it.each([
    ['guest', guestLogin], ['register', registerUser], ['login', loginUser], ['google', googleLogin],
    ['loadMe', loadMe], ['updateMe', updateMe],
  ] as const)('AUTH-9 %s fulfilled stores the user', (_name, thunk) => {
    const s = authReducer(start({ loading: true, checked: false }), { type: thunk.fulfilled.type, payload: user() });
    expect(s).toEqual({ user: user(), loading: false, checked: true, error: null });
  });

  it('AUTH-9 rejected stores the failure and keeps the user', () => {
    const f = fail({ action: 'updateMe', status: 400, error: 'Name must be 3–20 characters' });
    const s = authReducer(start({ user: user(), loading: true }), { type: updateMe.rejected.type, payload: f });
    expect(s).toMatchObject({ user: user(), loading: false, checked: true, error: f });
  });

  it('AUTH-9 loadMe 401 signs out; loadMe network failure keeps the user', () => {
    const r401 = authReducer(start({ user: user() }), { type: loadMe.rejected.type, payload: fail({ action: 'loadMe', status: 401, error: 'x' }) });
    expect(r401.user).toBeNull();
    const r0 = authReducer(start({ user: user() }), { type: loadMe.rejected.type, payload: fail({ action: 'loadMe', status: 0, error: 'x' }) });
    expect(r0.user).toEqual(user());
  });

  it('AUTH-9 logout clears the user', () => {
    const s = authReducer(start({ user: user() }), { type: logout.fulfilled.type });
    expect(s).toMatchObject({ user: null, checked: true, error: null });
  });

  it('AUTH-9 known failures get a translated message', () => {
    expect(authErrorKey(fail({ action: 'login', status: 401, error: '' }))).toBe('auth.err.badLogin');
    expect(authErrorKey(fail({ action: 'register', status: 409, error: '' }))).toBe('auth.err.emailTaken');
    expect(authErrorKey(fail({ action: 'guest', status: 429, error: '' }))).toBe('auth.err.rateLimit');
    expect(authErrorKey(fail({ action: 'guest', status: 0, error: '' }))).toBe('auth.err.network');
    expect(authErrorKey(fail({ action: 'google', status: 401, error: '' }))).toBe('auth.err.google');
    expect(authErrorKey(fail({ action: 'register', status: 400, error: 'Enter a valid email' }))).toBeNull();
  });
});

describe('authSlice thunks', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });
  afterEach(() => localStorage.clear());

  it('AUTH-9 guest saves the token; later calls send it', async () => {
    post.mockResolvedValueOnce({ data: { token: 'tok-1', user: user() } });
    const store = makeStore();
    await store.dispatch(guestLogin(undefined));
    expect(post).toHaveBeenCalledWith(`${API_BASE}/auth/guest`, {}, { headers: {} });
    expect(localStorage.getItem(TOKEN_KEY)).toBe('tok-1');
    expect(getAuthHeaders()).toEqual({ Authorization: 'Bearer tok-1' });
    expect(store.getState().auth.user).toEqual(user());
  });

  it('AUTH-9 register sends the guest token (upgrade) and keeps the new token', async () => {
    setToken('guest-tok');
    post.mockResolvedValueOnce({ data: { token: 'tok-2', user: user({ isGuest: false }) } });
    const store = makeStore();
    await store.dispatch(registerUser({ name: 'Rina', email: 'r@example.com', password: 'correct horse' }));
    expect(post.mock.calls[0]?.[2]).toEqual({ headers: { Authorization: 'Bearer guest-tok' } });
    expect(getToken()).toBe('tok-2');
  });

  it('AUTH-9 rejected login carries the server error and keeps no token', async () => {
    post.mockRejectedValueOnce(httpError(401, 'Wrong email or password'));
    const store = makeStore();
    await store.dispatch(loginUser({ email: 'r@example.com', password: 'nope' }));
    expect(store.getState().auth.error).toEqual({ action: 'login', status: 401, error: 'Wrong email or password' });
    expect(getToken()).toBeNull();
  });

  it('AUTH-9 loadMe 401 forgets the saved token; logout too', async () => {
    setToken('old');
    get.mockRejectedValueOnce(httpError(401, 'Sign in required'));
    const store = makeStore();
    expect(store.getState().auth.checked).toBe(false);
    await store.dispatch(loadMe());
    expect(getToken()).toBeNull();
    expect(store.getState().auth).toMatchObject({ user: null, checked: true });

    setToken('again');
    await store.dispatch(logout());
    expect(getToken()).toBeNull();
  });
});
