// IAP-1..4: Google Play Billing on Android only. Every export is a quiet no-op
// on the web. This file never credits coins: it hands purchase tokens to the
// caller, which sends them to POST /iap/verify (the server verifies and consumes).
import { NativePurchases, PURCHASE_TYPE } from '@capgo/native-purchases';
import { Capacitor } from '@capacitor/core';
import { IAP_PACKS, type IapProductId, type IapVerifyRequest } from '@carrom/protocol';

/** IAP-6: only the Android app sells coin packs. */
export function billingSupported(): boolean {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';
}

/** A pack the store offers: the price is the store's localized string (IAP-1, never hard-coded). */
export interface StorePack { productId: IapProductId; coins: number; price: string }

const isPack = (id: string): id is IapProductId => IAP_PACKS.some((p) => p.productId === id);

let configured: Promise<void> | null = null;

/** The server acknowledges (consumes) purchases, so the plugin must never finish them itself. */
function setup(): Promise<void> {
  configured ??= NativePurchases.configure({ autoFinishTransactions: false }).catch(() => {});
  return configured;
}

/** For tests: forget the setup call. */
export function resetBillingForTest(): void {
  configured = null;
}

/** IAP-1: the packs Play returns, in our order; [] when billing is off or the store can't be reached. */
export async function loadPacks(): Promise<StorePack[]> {
  if (!billingSupported()) return [];
  try {
    await setup();
    const { products } = await NativePurchases.getProducts({
      productIdentifiers: IAP_PACKS.map((p) => p.productId), productType: PURCHASE_TYPE.INAPP,
    });
    return IAP_PACKS.flatMap((p) => {
      const found = products.find((x) => x.identifier === p.productId);
      return found ? [{ productId: p.productId, coins: p.coins, price: found.priceString }] : [];
    });
  } catch {
    return [];
  }
}

/**
 * IAP-2: open Play's purchase sheet. The user id goes along as the account id
 * (Play's obfuscatedAccountId), so the server can tell whose purchase it is.
 * Resolves to what to send to /iap/verify, or null when nothing was bought
 * (closed sheet, error).
 */
export async function purchasePack(productId: IapProductId, userId: string): Promise<IapVerifyRequest | null> {
  if (!billingSupported()) return null;
  try {
    await setup();
    const tx = await NativePurchases.purchaseProduct({
      productIdentifier: productId, productType: PURCHASE_TYPE.INAPP, appAccountToken: userId,
      isConsumable: false, autoAcknowledgePurchases: false,
    });
    return tx.purchaseToken ? { productId, purchaseToken: tx.purchaseToken } : null;
  } catch {
    return null;
  }
}

/**
 * IAP-4: this user's coin-pack purchases Play still holds (not consumed yet:
 * pending payments, or a verify that never reached the server). Sending them
 * to /iap/verify again credits each once.
 */
export async function unfinishedPurchases(userId: string): Promise<IapVerifyRequest[]> {
  if (!billingSupported()) return [];
  try {
    await setup();
    const { purchases } = await NativePurchases.getPurchases({ productType: PURCHASE_TYPE.INAPP, appAccountToken: userId });
    return purchases.flatMap((p) =>
      isPack(p.productIdentifier) && p.purchaseToken ? [{ productId: p.productIdentifier, purchaseToken: p.purchaseToken }] : []);
  } catch {
    return [];
  }
}
