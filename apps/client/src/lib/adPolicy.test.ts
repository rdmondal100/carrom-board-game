import { describe, expect, it } from 'vitest';
import { ADS, adUnitsFrom, TEST_AD_UNITS } from '@/constants/ads';
import {
  gameFinished, initialAdPolicy, interstitialShown, mayShowInterstitial, parseAdPolicy, type AdPolicyState,
} from './adPolicy';

const after = (n: number, s: AdPolicyState = initialAdPolicy()) =>
  Array.from({ length: n }).reduce<AdPolicyState>((acc) => gameFinished(acc), s);
const MIN = 60 * 1000;

describe('AD-4 interstitial policy', () => {
  it('AD-4 1 per 3 games', () => {
    expect(mayShowInterstitial(after(1), 'gameEnd', 0)).toBe(false);
    expect(mayShowInterstitial(after(2), 'gameEnd', 0)).toBe(false);
    expect(mayShowInterstitial(after(3), 'gameEnd', 0)).toBe(true);
    const shown = interstitialShown(after(3), 10 * MIN);
    expect(shown.gamesSinceAd).toBe(0);
    expect(mayShowInterstitial(after(2, shown), 'gameEnd', 30 * MIN)).toBe(false);
    expect(mayShowInterstitial(after(3, shown), 'gameEnd', 30 * MIN)).toBe(true);
  });

  it('AD-4 3-minute gap since the last one', () => {
    const shown = interstitialShown(after(3), 100 * MIN);
    const three = after(3, shown);
    expect(mayShowInterstitial(three, 'gameEnd', 100 * MIN + ADS.interstitialGapMs - 1)).toBe(false);
    expect(mayShowInterstitial(three, 'gameEnd', 100 * MIN + ADS.interstitialGapMs)).toBe(true);
  });

  it('AD-4 never mid-match, never at start', () => {
    const due = after(10);
    expect(mayShowInterstitial(due, 'inMatch', 0)).toBe(false);
    expect(mayShowInterstitial(due, 'appStart', 0)).toBe(false);
    expect(mayShowInterstitial(due, 'gameEnd', 0)).toBe(true);
  });

  it('AD-4 saved state round-trips; damaged state starts fresh', () => {
    const s = interstitialShown(after(3), 1234);
    expect(parseAdPolicy(JSON.stringify(after(2, s)))).toEqual({ gamesSinceAd: 2, lastAdAt: 1234 });
    expect(parseAdPolicy(null)).toEqual(initialAdPolicy());
    expect(parseAdPolicy('{bad')).toEqual(initialAdPolicy());
    expect(parseAdPolicy('{"gamesSinceAd":-4,"lastAdAt":"x"}')).toEqual(initialAdPolicy());
  });
});

describe('AD-6 ad unit ids', () => {
  const real = { VITE_ADMOB_REWARDED_ID: 'r', VITE_ADMOB_INTERSTITIAL_ID: 'i', VITE_ADMOB_BANNER_ID: 'b' };
  it('AD-6 dev always uses Google test ids', () => {
    expect(adUnitsFrom(real, true)).toEqual({ ...TEST_AD_UNITS, testing: true });
  });
  it('AD-6 a build uses the env ids, or test ids when any is missing', () => {
    expect(adUnitsFrom(real, false)).toEqual({ rewarded: 'r', interstitial: 'i', banner: 'b', testing: false });
    expect(adUnitsFrom({ ...real, VITE_ADMOB_BANNER_ID: ' ' }, false).testing).toBe(true);
  });
});
