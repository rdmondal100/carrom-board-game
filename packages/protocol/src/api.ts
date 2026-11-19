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

export interface Cosmetics {
  equipped: string[];
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
