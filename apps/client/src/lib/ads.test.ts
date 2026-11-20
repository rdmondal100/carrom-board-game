import { beforeEach, describe, expect, it, vi } from 'vitest';

const platform = vi.hoisted(() => ({ native: false, name: 'web' }));
vi.mock('@capacitor/core', () => ({
  Capacitor: { isNativePlatform: () => platform.native, getPlatform: () => platform.name },
}));

// A fake AdMob: listeners by event name, and calls recorded in order.
const fake = vi.hoisted(() => {
  const listeners = new Map<string, (() => void)[]>();
  const calls: string[] = [];
  const emit = (e: string) => { for (const fn of listeners.get(e) ?? []) fn(); };
  const consent = { status: 'NOT_REQUIRED', isConsentFormAvailable: false, canRequestAds: true };
  return { listeners, calls, emit, consent };
});
vi.mock('@capacitor-community/admob', () => {
  const rec = (name: string, out: unknown = undefined) => vi.fn(async () => { fake.calls.push(name); return out; });
  return {
    AdmobConsentStatus: { REQUIRED: 'REQUIRED', NOT_REQUIRED: 'NOT_REQUIRED', OBTAINED: 'OBTAINED', UNKNOWN: 'UNKNOWN' },
    BannerAdPosition: { BOTTOM_CENTER: 'BOTTOM_CENTER' },
    BannerAdSize: { ADAPTIVE_BANNER: 'ADAPTIVE_BANNER' },
    InterstitialAdPluginEvents: { Dismissed: 'iDismissed', FailedToShow: 'iFailedToShow' },
    RewardAdPluginEvents: { Dismissed: 'rDismissed', FailedToShow: 'rFailedToShow', Rewarded: 'rRewarded' },
    AdMob: {
      initialize: rec('initialize'),
      requestConsentInfo: vi.fn(async () => { fake.calls.push('requestConsentInfo'); return { ...fake.consent }; }),
      showConsentForm: vi.fn(async () => { fake.calls.push('showConsentForm'); return { ...fake.consent, status: 'OBTAINED', canRequestAds: true }; }),
      prepareRewardVideoAd: rec('prepareRewardVideoAd'),
      showRewardVideoAd: vi.fn(async () => { fake.calls.push('showRewardVideoAd'); fake.emit('rRewarded'); fake.emit('rDismissed'); return { type: 'coins', amount: 25 }; }),
      prepareInterstitial: rec('prepareInterstitial'),
      showInterstitial: vi.fn(async () => { fake.calls.push('showInterstitial'); setTimeout(() => fake.emit('iDismissed'), 0); }),
      showBanner: rec('showBanner'),
      removeBanner: rec('removeBanner'),
      addListener: vi.fn(async (e: string, fn: () => void) => {
        fake.listeners.set(e, [...(fake.listeners.get(e) ?? []), fn]);
        return { remove: async () => { fake.listeners.set(e, (fake.listeners.get(e) ?? []).filter((f) => f !== fn)); } };
      }),
    },
  };
});

const { AdMob } = await import('@capacitor-community/admob');
const ads = await import('./ads');

describe('lib/ads', () => {
  beforeEach(() => {
    localStorage.clear();
    fake.calls.length = 0;
    fake.listeners.clear();
    Object.assign(fake.consent, { status: 'NOT_REQUIRED', isConsentFormAvailable: false, canRequestAds: true });
    ads.resetAdsForTest();
    vi.clearAllMocks();
  });

  describe('on the web', () => {
    beforeEach(() => Object.assign(platform, { native: false, name: 'web' }));

    it('AD-1 lib/ads is a no-op on web: no AdMob call at all', async () => {
      expect(ads.adsSupported()).toBe(false);
      expect(await ads.initAds()).toBe(false);
      expect(await ads.showRewarded('u1')).toBe('unavailable');
      for (let i = 0; i < 5; i++) ads.noteGameFinished();
      expect(await ads.maybeInterstitial('gameEnd')).toBe(false);
      await ads.setMenuBanner(true);
      expect(fake.calls).toEqual([]);
      expect(localStorage.length).toBe(0);
    });

    it('AD-1 iOS (native but not Android) shows no ads either', async () => {
      Object.assign(platform, { native: true, name: 'ios' });
      expect(await ads.initAds()).toBe(false);
      expect(AdMob.initialize).not.toHaveBeenCalled();
    });
  });

  describe('on Android', () => {
    beforeEach(() => Object.assign(platform, { native: true, name: 'android' }));

    it('AD-2 the consent form runs before any ad request when consent is required', async () => {
      Object.assign(fake.consent, { status: 'REQUIRED', isConsentFormAvailable: true, canRequestAds: false });
      expect(await ads.showRewarded('u1')).toBe('earned');
      expect(fake.calls.slice(0, 4)).toEqual(['initialize', 'requestConsentInfo', 'showConsentForm', 'prepareRewardVideoAd']);
    });

    it('AD-2 ads follow the consent result: no ad is requested when ads may not be requested', async () => {
      Object.assign(fake.consent, { status: 'OBTAINED', canRequestAds: false });
      expect(await ads.showRewarded('u1')).toBe('unavailable');
      expect(AdMob.prepareRewardVideoAd).not.toHaveBeenCalled();
      expect(fake.calls).toEqual(['initialize', 'requestConsentInfo']);
    });

    it('AD-3 rewarded: the user id goes to SSV; earned only after the Rewarded event', async () => {
      expect(await ads.showRewarded('user-42')).toBe('earned');
      expect(vi.mocked(AdMob.prepareRewardVideoAd).mock.calls[0]?.[0]).toMatchObject({ ssv: { userId: 'user-42' } });
      vi.mocked(AdMob.showRewardVideoAd).mockImplementationOnce(async () => {
        fake.emit('rDismissed');
        return new Promise(() => {}) as never;
      });
      expect(await ads.showRewarded('user-42')).toBe('closed');
      expect([...fake.listeners.values()].flat()).toHaveLength(0);
    });

    it('AD-4 interstitial: only after 3 finished games, then not again at once', async () => {
      ads.noteGameFinished();
      ads.noteGameFinished();
      expect(await ads.maybeInterstitial('gameEnd', 1_000_000)).toBe(false);
      ads.noteGameFinished();
      expect(await ads.maybeInterstitial('inMatch', 1_000_000)).toBe(false);
      expect(await ads.maybeInterstitial('gameEnd', 1_000_000)).toBe(true);
      expect(AdMob.showInterstitial).toHaveBeenCalledTimes(1);
      for (let i = 0; i < 3; i++) ads.noteGameFinished();
      expect(await ads.maybeInterstitial('gameEnd', 1_000_000 + 60_000)).toBe(false);
    });

    it('AD-5 the menu banner is off unless the owner enables it', async () => {
      await ads.setMenuBanner(true);
      expect(AdMob.showBanner).not.toHaveBeenCalled();
    });
  });
});
