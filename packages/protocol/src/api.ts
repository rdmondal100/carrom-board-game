/**
 * HTTP API types for `/auth/*` (spec 08). The server imports these as types
 * only (it can't load workspace packages at runtime yet); the client also
 * uses the constants for its forms.
 */

export const NAME_MIN = 3;
export const NAME_MAX = 20;
export const PASSWORD_MIN = 8;
/** Avatars are an index into a fixed set of AVATAR_COUNT pictures. */
export const AVATAR_COUNT = 12;

import type { Equipped } from './cosmetics';

/** COS-5: `owned` already includes the default items; `equipped` has one item id per slot. */
export interface Cosmetics {
  equipped: Equipped;
  owned: string[];
}

/** What the server sends back for the signed-in player. Never holds secrets. */
export interface PublicUser {
  id: string;
  name: string;
  email: string | null;
  isGuest: boolean;
  hasPassword: boolean;
  hasGoogle: boolean;
  avatar: number;
  rating: number;
  coins: number;
  cosmetics: Cosmetics;
  createdAt: string;
}

export interface GuestRequest { name?: string }
export interface RegisterRequest { name: string; email: string; password: string }
export interface LoginRequest { email: string; password: string }
export interface GoogleRequest { idToken: string }
export interface UpdateMeRequest { name?: string; avatar?: number }

/** guest, register, login and google all answer with this. */
export interface AuthResponse { token: string; user: PublicUser }
export interface MeResponse { user: PublicUser }

/** Every error answer: `{ error }` (plus `stack` outside production). */
export interface ApiError { error: string }

// ---- ranked (spec 10) ------------------------------------------------------

/** RANK-6: one row of the leaderboard. `rank` is 1-based. */
export interface LeaderboardEntry { rank: number; id: string; name: string; avatar: number; rating: number }

/** GET /leaderboard: top players, plus the caller's row when signed in and ranked. */
export interface LeaderboardResponse { players: LeaderboardEntry[]; me: LeaderboardEntry | null }

/** RANK-5: one player of a finished match. `team` is 'A' or 'B'. */
export interface MatchPlayerView {
  userId: string; name: string; seat: number; team: 'A' | 'B'; ratingBefore: number; ratingAfter: number;
}

/** RANK-5: a finished online game. */
export interface MatchView {
  id: string;
  ranked: boolean;
  winner: 'A' | 'B';
  /** Boards played. */
  boards: number;
  /** The loser left and did not come back (RANK-4). */
  abandoned: boolean;
  players: MatchPlayerView[];
  createdAt: string;
}

/** GET /matches/me */
export interface MatchesResponse { matches: MatchView[] }

// ---- cosmetics (spec 12) ---------------------------------------------------

/** COS-3 POST /shop/buy */
export interface BuyRequest { itemId: string }
/** COS-4 PATCH /me/equip: only owned items. */
export type EquipRequest = Partial<Equipped>;
/** COS-2 POST /me/bot-reward: a finished Vs-bot game, reported by the client. */
export interface BotRewardRequest { won: boolean }
/** COS-2 daily bonus, bot and online rewards: coins given now (0 = none) and the updated user. */
export interface RewardResponse { reward: number; user: PublicUser }
