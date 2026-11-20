/** AD-3 rewarded ads. The client's copy for display is apps/client/src/constants/ads.ts. */
export const ADS_CONFIG = {
  /** Coins per verified rewarded ad (AdMob's own reward_amount is ignored). */
  rewardedCoins: 25,
  /** Rewarded ads that pay per UTC day; later ones are recorded but not credited. */
  rewardedPerDay: 5,
  /** Google's AdMob SSV public keys. */
  keysUrl: 'https://www.gstatic.com/admob/reward/verifier-keys.json',
  /** Keys are re-fetched after this long, or at once when a callback names an unknown key id. */
  keysTtlMs: 24 * 60 * 60 * 1000,
} as const;
