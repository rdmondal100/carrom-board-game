// AD-1..6: AdMob on Android only. Every export is a quiet no-op on the web and
// when consent says no ads; ads never block the game (failures are swallowed).
import {
  AdMob, AdmobConsentStatus, BannerAdPosition, BannerAdSize, InterstitialAdPluginEvents, RewardAdPluginEvents,
} from '@capacitor-community/admob';
import { Capacitor, type PluginListenerHandle } from '@capacitor/core';
import { AD_UNITS, ADS_MENU_BANNER } from '@/constants/ads';
import {
  gameFinished, interstitialShown, mayShowInterstitial, parseAdPolicy, type AdMoment, type AdPolicyState,
} from '@/game/adPolicy';
import { readStorage, writeStorage } from './storage';

const POLICY_KEY = 'carrom.adPolicy';

/** AD-1: only the Android app shows ads. */
export function adsSupported(): boolean {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';
}

let ready: Promise<boolean> | null = null;

/**
 * AD-2: start AdMob and run Google's UMP consent flow (form only when it is
 * required). Resolves to whether ads may be requested; nothing asks for an ad
 * before this. Runs once; later calls get the same answer.
 */
export function initAds(): Promise<boolean> {
  if (!adsSupported()) return Promise.resolve(false);
  ready ??= (async () => {
    await AdMob.initialize({ initializeForTesting: AD_UNITS.testing });
    let info = await AdMob.requestConsentInfo();
    if (info.status === AdmobConsentStatus.REQUIRED && info.isConsentFormAvailable) {
      info = await AdMob.showConsentForm();
    }
    return info.canRequestAds;
  })().catch(() => false);
  return ready;
}

/** For tests: forget the init result. */
export function resetAdsForTest(): void {
  ready = null;
}

const common = () => ({ isTesting: AD_UNITS.testing, immersiveMode: true });

/** Listeners on several ad events: `seen` fills as they fire; `end` resolves with the first of `endEvents`. */
interface Watch { seen: Set<string>; end: Promise<string>; remove: () => void }

async function watch(events: string[], endEvents: string[]): Promise<Watch> {
  const seen = new Set<string>();
  let finish: (e: string) => void = () => {};
  const end = new Promise<string>((resolve) => { finish = resolve; });
  // The plugin types listeners per event enum; all we need is "it happened".
  const on = AdMob.addListener as (ev: string, fn: () => void) => Promise<PluginListenerHandle>;
  const handles = await Promise.all(events.map((e) => on(e, () => {
    seen.add(e);
    if (endEvents.includes(e)) finish(e);
  })));
  return { seen, end, remove: () => { for (const h of handles) void h.remove(); } };
}

export type RewardedResult = 'earned' | 'closed' | 'unavailable';

/**
 * AD-3: show a rewarded ad. `userId` goes to AdMob's server-side verification,
 * which is what credits the coins (never this function). Resolves after the ad closes.
 */
export async function showRewarded(userId: string): Promise<RewardedResult> {
  if (!(await initAds())) return 'unavailable';
  try {
    await AdMob.prepareRewardVideoAd({ adId: AD_UNITS.rewarded, ...common(), ssv: { userId } });
    const ends = [RewardAdPluginEvents.Dismissed, RewardAdPluginEvents.FailedToShow];
    const w = await watch([RewardAdPluginEvents.Rewarded, ...ends], ends);
    try {
      // Resolves only when a reward is earned, so the events say when the ad is over.
      void AdMob.showRewardVideoAd().catch(() => {});
      const how = await w.end;
      if (w.seen.has(RewardAdPluginEvents.Rewarded)) return 'earned';
      return how === RewardAdPluginEvents.FailedToShow ? 'unavailable' : 'closed';
    } finally {
      w.remove();
    }
  } catch {
    return 'unavailable';
  }
}

function loadPolicy(): AdPolicyState {
  return parseAdPolicy(readStorage(POLICY_KEY));
}

/** AD-4: a game just finished (its end screen opened). */
export function noteGameFinished(): void {
  if (!adsSupported()) return;
  writeStorage(POLICY_KEY, JSON.stringify(gameFinished(loadPolicy())));
}

/**
 * AD-4: show an interstitial if the policy allows it at this moment
 * (only when leaving a finished game). Resolves once it is closed, so the
 * next screen (and its shot clock) starts after the ad.
 */
export async function maybeInterstitial(moment: AdMoment, nowMs = Date.now()): Promise<boolean> {
  if (!adsSupported()) return false;
  const policy = loadPolicy();
  if (!mayShowInterstitial(policy, moment, nowMs)) return false;
  if (!(await initAds())) return false;
  try {
    await AdMob.prepareInterstitial({ adId: AD_UNITS.interstitial, ...common() });
    const ends = [InterstitialAdPluginEvents.Dismissed, InterstitialAdPluginEvents.FailedToShow];
    const w = await watch(ends, ends);
    try {
      await AdMob.showInterstitial();
      writeStorage(POLICY_KEY, JSON.stringify(interstitialShown(policy, nowMs)));
      return (await w.end) === InterstitialAdPluginEvents.Dismissed;
    } finally {
      w.remove();
    }
  } catch {
    return false;
  }
}

/** AD-5: a small banner on menu screens, only when ADS_MENU_BANNER is on; never on the game screen. */
export async function setMenuBanner(show: boolean): Promise<void> {
  if (!ADS_MENU_BANNER || !adsSupported()) return;
  try {
    if (!show) {
      await AdMob.removeBanner();
      return;
    }
    if (!(await initAds())) return;
    await AdMob.showBanner({
      adId: AD_UNITS.banner, ...common(), adSize: BannerAdSize.ADAPTIVE_BANNER, position: BannerAdPosition.BOTTOM_CENTER,
    });
  } catch {
    // No banner is fine.
  }
}
