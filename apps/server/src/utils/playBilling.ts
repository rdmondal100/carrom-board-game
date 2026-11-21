import { JWT } from 'google-auth-library';
import type { ServiceAccount } from '../env.js';
import { IAP_CONFIG } from './iapConfig.js';

/** Play's purchaseState for a one-time product. */
export const PURCHASED = 0;
export const CANCELLED = 1;
export const PENDING = 2;

/** What the Play Developer API says about one product purchase token. */
export interface ProductPurchase {
  /** 0 purchased, 1 cancelled (incl. refunded), 2 pending. */
  purchaseState: number;
  /** 0 not consumed yet, 1 consumed. */
  consumptionState: number;
  orderId: string | null;
  /** What the app passed as the account id when buying (here: the user id). */
  accountId: string | null;
}

/** IAP-3: the two Play Developer API calls the server needs (tests pass a fake). HAPP-9 per app package. */
export interface PlayBilling {
  /** null when Google does not know the token for this product (invalid, wrong product, expired). */
  getProduct(packageName: string, productId: string, purchaseToken: string): Promise<ProductPurchase | null>;
  consume(packageName: string, productId: string, purchaseToken: string): Promise<void>;
}

/** An authorised HTTP call (google-auth-library's JWT client fits). Throws on a non-2xx answer. */
export interface Requester {
  request<T>(opts: { url: string; method: 'GET' | 'POST' }): Promise<{ data: T }>;
}

/** HTTP status of a failed request, from a gaxios error. */
function statusOf(err: unknown): number | undefined {
  if (typeof err !== 'object' || err === null) return undefined;
  const e = err as { status?: unknown; response?: { status?: unknown } };
  const s = e.response?.status ?? e.status;
  return typeof s === 'number' ? s : undefined;
}

const NOT_FOUND = new Set([400, 404, 410]);

interface RawPurchase {
  purchaseState?: number;
  consumptionState?: number;
  orderId?: string;
  obfuscatedExternalAccountId?: string;
  productId?: string;
}

/** IAP-3 Play Billing through the Play Developer API, signed in with a service account. */
export function googlePlayBilling(auth: Requester): PlayBilling {
  const url = (packageName: string, productId: string, token: string, action = '') =>
    `${IAP_CONFIG.apiBase}/${encodeURIComponent(packageName)}/purchases/products/`
    + `${encodeURIComponent(productId)}/tokens/${encodeURIComponent(token)}${action}`;
  return {
    async getProduct(packageName, productId, purchaseToken) {
      let data: RawPurchase;
      try {
        data = (await auth.request<RawPurchase>({ url: url(packageName, productId, purchaseToken), method: 'GET' })).data;
      } catch (err) {
        if (NOT_FOUND.has(statusOf(err) ?? 0)) return null;
        throw err;
      }
      if (typeof data.purchaseState !== 'number') return null;
      if (data.productId !== undefined && data.productId !== productId) return null;
      return {
        purchaseState: data.purchaseState,
        consumptionState: data.consumptionState ?? 0,
        orderId: data.orderId ?? null,
        accountId: data.obfuscatedExternalAccountId ?? null,
      };
    },
    async consume(packageName, productId, purchaseToken) {
      await auth.request({ url: url(packageName, productId, purchaseToken, ':consume'), method: 'POST' });
    },
  };
}

/** The real thing: a JWT client for the service account from the env. */
export function playBillingFromEnv(account: ServiceAccount): PlayBilling {
  const jwt = new JWT({ email: account.clientEmail, key: account.privateKey, scopes: [IAP_CONFIG.scope] });
  return googlePlayBilling(jwt);
}
