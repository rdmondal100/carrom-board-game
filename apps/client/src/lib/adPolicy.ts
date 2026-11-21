// AD-4: when an interstitial may show. Pure: time comes in, nothing reads the clock.
import { ADS } from '@/constants/ads';

export interface AdPolicyState {
  /** Finished games since the last interstitial (or since install). */
  gamesSinceAd: number;
  /** When the last interstitial showed (ms), or null. */
  lastAdAt: number | null;
}

/** Where the app is when it asks. Only 'gameEnd' (a finished game being left) can show an ad. */
export type AdMoment = 'gameEnd' | 'appStart' | 'inMatch';

export const initialAdPolicy = (): AdPolicyState => ({ gamesSinceAd: 0, lastAdAt: null });

/** A game finished (counted once, when its end screen appears). */
export function gameFinished(s: AdPolicyState): AdPolicyState {
  return { ...s, gamesSinceAd: s.gamesSinceAd + 1 };
}

/** AD-4: after a finished game only, at most 1 per 3 games, never within 3 minutes of the last one. */
export function mayShowInterstitial(s: AdPolicyState, moment: AdMoment, nowMs: number): boolean {
  if (moment !== 'gameEnd') return false;
  if (s.gamesSinceAd < ADS.interstitialEveryGames) return false;
  return s.lastAdAt === null || nowMs - s.lastAdAt >= ADS.interstitialGapMs;
}

export function interstitialShown(_s: AdPolicyState, nowMs: number): AdPolicyState {
  return { gamesSinceAd: 0, lastAdAt: nowMs };
}

/** A saved policy state, or a fresh one when it is missing or damaged. */
export function parseAdPolicy(raw: string | null): AdPolicyState {
  try {
    const v = JSON.parse(raw ?? '') as Partial<AdPolicyState>;
    const games = typeof v.gamesSinceAd === 'number' && v.gamesSinceAd >= 0 ? Math.floor(v.gamesSinceAd) : 0;
    const last = typeof v.lastAdAt === 'number' && Number.isFinite(v.lastAdAt) ? v.lastAdAt : null;
    return { gamesSinceAd: games, lastAdAt: last };
  } catch {
    return initialAdPolicy();
  }
}
