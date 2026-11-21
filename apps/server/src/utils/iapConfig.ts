import { IAP_PACKS, type IapProductId } from '@carrom/protocol/api';

/** IAP-1 the coin packs players can buy: product id → coins. Prices live in Play Console. */
export const IAP_CONFIG = {
  packs: IAP_PACKS,
  /** Longest purchase token accepted (Google's are a few hundred characters). */
  tokenMax: 4096,
  /** Longest app package name accepted (HAPP-9). */
  packageMax: 255,
  /** Play Developer API: base URL and OAuth scope. */
  apiBase: 'https://androidpublisher.googleapis.com/androidpublisher/v3/applications',
  scope: 'https://www.googleapis.com/auth/androidpublisher',
} as const;

export const IAP_PRODUCT_IDS = IAP_PACKS.map((p) => p.productId) as [IapProductId, ...IapProductId[]];

/** Coins one pack gives, or 0 for an unknown product. */
export function packCoins(productId: string): number {
  return IAP_PACKS.find((p) => p.productId === productId)?.coins ?? 0;
}
