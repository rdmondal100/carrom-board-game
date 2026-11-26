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

import type { CosmeticGame, CosmeticType, EquippedMap } from './cosmetics';
import type { MissionView } from './progress';
import type { ReportReason } from './voice';

/** COS-5: `owned` already includes the default items. HAPP-5 `equipped` = one item id per slot, per game. */
export interface Cosmetics {
  equipped: EquippedMap;
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
  /** @deprecated HUB-7 the carrom rating; use `ratings.carrom` (kept one release for old clients). */
  rating: number;
  /** HUB-7 rating per game id; a game not listed reads as START_RATING with 0 games. */
  ratings: Record<string, GameRating>;
  coins: number;
  /** PRG-1 total XP and the level it makes (levelOf(xp)). */
  xp: number;
  level: number;
  cosmetics: Cosmetics;
  /** VOICE-6 user ids this player blocked (their voice is never played for them). */
  blocked: string[];
  createdAt: string;
}

/** HUB-7 one game's Elo rating and the ranked games played. */
export interface GameRating { rating: number; games: number }

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

/** RANK-5: one player of a finished match. `team` is the game's team id (carrom: 'A' or 'B'). */
export interface MatchPlayerView {
  userId: string; name: string; seat: number; team: string; ratingBefore: number; ratingAfter: number;
}

/** RANK-5: a finished online game. */
export interface MatchView {
  id: string;
  /** HUB-9 the game played. */
  game: string;
  ranked: boolean;
  /** The winning team id (carrom: 'A' or 'B'). */
  winner: string;
  /** Boards (rounds) played. */
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
/** COS-4 / HAPP-5 PATCH /me/equip: only owned items, for one game's slots (`game` defaults to carrom). */
export type EquipRequest = { game?: CosmeticGame } & Partial<Record<CosmeticType, string>>;
/** COS-2 POST /me/bot-reward: a finished Vs-bot game, reported by the client. PRG-7 `game` defaults to carrom. */
export interface BotRewardRequest { won: boolean; game?: string }
/**
 * COS-2 daily bonus, bot and online rewards: coins given now (0 = none) and the updated user.
 * PRG-7 `xp` given by a game; on a level-up the new `level` and its coins (`levelCoins`, on top of
 * `reward`). PRG-6 `streak` = days in a row (daily bonus only).
 */
export interface RewardResponse {
  reward: number; user: PublicUser; xp?: number; level?: number; levelCoins?: number; streak?: number;
}

// ---- progress (spec 24) ----------------------------------------------------

/** PRG-6 the login streak: days in a row (0 = broken), the week day lit today (1..7), claimed today or not. */
export interface StreakView { count: number; day: number; claimedToday: boolean }

/** PRG-7 GET /me/progress, and the answer to a mission claim or swap. */
export interface ProgressResponse {
  /** The UTC day the missions are for (YYYY-MM-DD). */
  day: string;
  xp: number;
  level: number;
  /** XP earned inside the current level, and the XP this level needs in all. */
  levelXp: number;
  levelNeed: number;
  streak: StreakView;
  missions: MissionView[];
  swapsLeft: number;
  /** Coins and XP given by this call (claim only); `level` and `levelCoins` on a level-up. */
  reward?: { coins: number; xp: number; level?: number; levelCoins?: number };
  user: PublicUser;
}

// ---- ads (spec 13) ---------------------------------------------------------

/** AD-3 GET /ads/status: rewarded ads that still pay today, and coins per ad. */
export interface AdStatusResponse { rewardedLeft: number; rewardedCoins: number }

// ---- in-app purchases (spec 14) -------------------------------------------

/** IAP-1 coin packs (Play Console consumable product ids) and the coins each gives. Prices come from the store. */
export const IAP_PACKS = [
  { productId: 'coins_500', coins: 500 },
  { productId: 'coins_1200', coins: 1200 },
  { productId: 'coins_2600', coins: 2600 },
] as const;
export type IapProductId = (typeof IAP_PACKS)[number]['productId'];

/**
 * IAP-2 POST /iap/verify: a Play Billing purchase to check and credit.
 * HAPP-9 `packageName` = the app it was bought in (one of the server's PLAY_PACKAGE_NAMES; missing = the first).
 */
export interface IapVerifyRequest { productId: string; purchaseToken: string; packageName?: string }
/**
 * IAP-3/4: `credited` = coins given by this call (0 on a replay or while
 * pending). 200 credited, 202 pending (retry later).
 */
export interface IapVerifyResponse { status: 'credited' | 'pending'; credited: number; user: PublicUser }

// ---- voice (spec 17) -------------------------------------------------------

/** VOICE-3 one ICE server as RTCPeerConnection takes it. */
export interface IceServer { urls: string[]; username?: string; credential?: string }
/** VOICE-3 GET /voice/ice: STUN, plus TURN with credentials valid for `ttl` seconds (≤ 1 h). */
export interface IceResponse { iceServers: IceServer[]; ttl: number }
/** VOICE-6 POST /reports. `matchId` = the room id the player was met in. */
export interface ReportRequest { userId: string; matchId: string; reason: ReportReason }
/** VOICE-6 POST /me/block. DELETE /me/block/:userId unblocks. */
export interface BlockRequest { userId: string }
