import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import axios from 'axios';
import type {
  AdStatusResponse, BotRewardRequest, BuyRequest, EquipRequest, IapVerifyRequest, IapVerifyResponse, MeResponse,
  PublicUser, RewardResponse,
} from '@carrom/protocol';
import { API_BASE } from '@/constants/apiBase';
import { getAuthHeaders } from '@/lib/auth';
import { userUpdated } from './authSlice';

export type ShopAction = 'buy' | 'equip' | 'dailyBonus' | 'botReward' | 'adStatus' | 'iap';

/** A failed call: HTTP status (0 = no answer) and the server's `error`. */
export interface ShopFailure { action: ShopAction; status: number; error: string }

export interface ShopState {
  /** The item id being bought or equipped, or null. */
  busy: string | null;
  error: ShopFailure | null;
  /** AD-3 rewarded ads that still pay today (null = not asked yet). */
  adsLeft: number | null;
}

export const initialShopState = (): ShopState => ({ busy: null, error: null, adsLeft: null });

function failure(action: ShopAction, err: unknown): ShopFailure {
  if (axios.isAxiosError<{ error?: unknown }>(err)) {
    const msg = err.response?.data?.error;
    return { action, status: err.response?.status ?? 0, error: typeof msg === 'string' ? msg : err.message };
  }
  return { action, status: 0, error: err instanceof Error ? err.message : String(err) };
}

type Cfg = { rejectValue: ShopFailure };

/** COS-3: buy one item; the user (coins, owned) comes back. */
export const buyItem = createAsyncThunk<PublicUser, string, Cfg>('shop/buy', async (itemId, { dispatch, rejectWithValue }) => {
  try {
    const body: BuyRequest = { itemId };
    const res = await axios.post<MeResponse>(`${API_BASE}/shop/buy`, body, { headers: getAuthHeaders() });
    dispatch(userUpdated(res.data.user));
    return res.data.user;
  } catch (err) {
    return rejectWithValue(failure('buy', err));
  }
});

/** COS-4: equip owned items. */
export const equipItems = createAsyncThunk<PublicUser, EquipRequest, Cfg>('shop/equip', async (body, { dispatch, rejectWithValue }) => {
  try {
    const res = await axios.patch<MeResponse>(`${API_BASE}/me/equip`, body, { headers: getAuthHeaders() });
    dispatch(userUpdated(res.data.user));
    return res.data.user;
  } catch (err) {
    return rejectWithValue(failure('equip', err));
  }
});

/** COS-2 / PRG-6: today's login bonus; resolves to the coins given (0 = already claimed today) and the streak. */
export const claimDailyBonus = createAsyncThunk<{ coins: number; streak: number }, void, Cfg>(
  'shop/dailyBonus', async (_, { dispatch, rejectWithValue }) => {
    try {
      const res = await axios.post<RewardResponse>(`${API_BASE}/me/daily-bonus`, {}, { headers: getAuthHeaders() });
      dispatch(userUpdated(res.data.user));
      return { coins: res.data.reward, streak: res.data.streak ?? 0 };
    } catch (err) {
      return rejectWithValue(failure('dailyBonus', err));
    }
  },
);

/** COS-2 coins for a game; PRG-7 its XP, and the new level and its coins on a level-up. */
export interface GameRewardInfo { coins: number; xp?: number; level?: number; levelCoins?: number }

/**
 * COS-2: a finished Vs-bot game of `game` (PRG-7: it moves that game's missions);
 * resolves to what was given (coins 0 once today's cap is used).
 */
export const claimBotReward = createAsyncThunk<GameRewardInfo, BotRewardRequest, Cfg>(
  'shop/botReward', async (body, { dispatch, rejectWithValue }) => {
    try {
      const res = await axios.post<RewardResponse>(`${API_BASE}/me/bot-reward`, body, { headers: getAuthHeaders() });
      dispatch(userUpdated(res.data.user));
      const { reward, xp, level, levelCoins } = res.data;
      return { coins: reward, xp, level, levelCoins };
    } catch (err) {
      return rejectWithValue(failure('botReward', err));
    }
  },
);

/** AD-3: how many rewarded ads still pay today. */
export const fetchAdStatus = createAsyncThunk<AdStatusResponse, void, Cfg>('shop/adStatus', async (_, { rejectWithValue }) => {
  try {
    const res = await axios.get<AdStatusResponse>(`${API_BASE}/ads/status`, { headers: getAuthHeaders() });
    return res.data;
  } catch (err) {
    return rejectWithValue(failure('adStatus', err));
  }
});

/**
 * IAP-2/4: send a Play purchase to the server, which verifies it with Google
 * and credits it once. `status: 'pending'` = payment not complete yet.
 */
export const verifyPurchase = createAsyncThunk<IapVerifyResponse, IapVerifyRequest, Cfg>(
  'shop/iap', async (body, { dispatch, rejectWithValue }) => {
    try {
      const res = await axios.post<IapVerifyResponse>(`${API_BASE}/iap/verify`, body, { headers: getAuthHeaders() });
      dispatch(userUpdated(res.data.user));
      return res.data;
    } catch (err) {
      return rejectWithValue(failure('iap', err));
    }
  },
);

const shopSlice = createSlice({
  name: 'shop',
  initialState: initialShopState,
  reducers: {
    clearShopError: (s) => { s.error = null; },
    /** AD-3 a rewarded ad was watched to the end (the server credits it a moment later). */
    adWatched: (s) => { if (s.adsLeft !== null) s.adsLeft = Math.max(0, s.adsLeft - 1); },
  },
  extraReducers: (b) => {
    b.addCase(fetchAdStatus.fulfilled, (s, a) => { s.adsLeft = a.payload.rewardedLeft; });
    b.addCase(buyItem.pending, (s, a) => { s.busy = a.meta.arg; s.error = null; });
    b.addCase(equipItems.pending, (s, a) => {
      s.busy = a.meta.arg.striker ?? a.meta.arg.coins ?? a.meta.arg.board ?? null;
      s.error = null;
    });
    for (const thunk of [buyItem, equipItems]) {
      b.addCase(thunk.fulfilled, (s) => { s.busy = null; });
      b.addCase(thunk.rejected, (s, a) => {
        s.busy = null;
        s.error = a.payload ?? { action: 'buy', status: 0, error: a.error.message ?? 'Request failed' };
      });
    }
  },
});

export const { adWatched, clearShopError } = shopSlice.actions;
export const shopReducer = shopSlice.reducer;

/** The i18n key for a shop failure we can say better than the server, else null (show `error`). */
export function shopErrorKey(f: ShopFailure): string | null {
  if (f.status === 0) return 'auth.err.network';
  if (f.status === 401) return 'shop.err.signIn';
  if (f.action === 'iap' && f.status === 400) return 'iap.err.invalid';
  if (f.action === 'iap' && (f.status === 403 || f.status === 409)) return 'iap.err.otherAccount';
  if (f.action === 'iap' && f.status === 503) return 'iap.err.off';
  if (f.action === 'buy' && f.status === 400) return 'shop.err.coins';
  if (f.action === 'buy' && f.status === 409) return 'shop.err.owned';
  if (f.status === 403) return 'shop.err.notOwned';
  if (f.status >= 500) return 'auth.err.server';
  return null;
}
