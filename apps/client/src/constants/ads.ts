// AD-1..6 client ad settings. The server's copy of the reward values is apps/server/src/utils/adsConfig.ts.

export const ADS = {
  /** AD-4 an interstitial at most once per this many finished games. */
  interstitialEveryGames: 3,
  /** AD-4 and never within this long of the last one. */
  interstitialGapMs: 3 * 60 * 1000,
  /** AD-3 coins the server gives per rewarded ad (shown on the button). */
  rewardedCoins: 25,
  /** AD-3 rewarded ads that pay per UTC day (the server enforces it). */
  rewardedPerDay: 5,
  /** AD-3 SSV reaches our server a little after the ad closes; re-read the balance after these delays. */
  refreshAfterRewardMs: [2000, 6000] as readonly number[],
} as const;

/** AD-6 Google's public test ad units (safe to click; they never pay). */
export const TEST_AD_UNITS = {
  rewarded: 'ca-app-pub-3940256099942544/5224354917',
  interstitial: 'ca-app-pub-3940256099942544/1033173712',
  banner: 'ca-app-pub-3940256099942544/6300978111',
} as const;

export type AdUnits = { rewarded: string; interstitial: string; banner: string };

function envId(raw: unknown): string {
  return typeof raw === 'string' ? raw.trim() : '';
}

/**
 * AD-6 ad unit ids: in dev always the test ids; in a build, VITE_ADMOB_* from
 * the env file (only the release env file holds real ids), else the test ids.
 */
export function adUnitsFrom(env: Record<string, unknown>, dev: boolean): AdUnits & { testing: boolean } {
  const units = {
    rewarded: envId(env.VITE_ADMOB_REWARDED_ID),
    interstitial: envId(env.VITE_ADMOB_INTERSTITIAL_ID),
    banner: envId(env.VITE_ADMOB_BANNER_ID),
  };
  const real = !dev && units.rewarded !== '' && units.interstitial !== '' && units.banner !== '';
  return real ? { ...units, testing: false } : { ...TEST_AD_UNITS, testing: true };
}

export const AD_UNITS = adUnitsFrom(import.meta.env, import.meta.env.DEV);

/** AD-5 a small banner on menu screens only when the owner turns it on (default off). */
export const ADS_MENU_BANNER: boolean = import.meta.env.VITE_ADS_MENU_BANNER === 'true';
