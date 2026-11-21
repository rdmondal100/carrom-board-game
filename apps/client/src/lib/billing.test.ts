import { beforeEach, describe, expect, it, vi } from 'vitest';

const platform = vi.hoisted(() => ({ native: false, name: 'web' }));
vi.mock('@capacitor/core', () => ({
  Capacitor: { isNativePlatform: () => platform.native, getPlatform: () => platform.name },
}));

// A fake Play Billing plugin.
const fake = vi.hoisted(() => ({
  products: [] as { identifier: string; priceString: string }[],
  purchases: [] as { productIdentifier: string; purchaseToken?: string }[],
  buy: null as null | ((opts: Record<string, unknown>) => Promise<{ purchaseToken?: string }>),
}));
const plugin = vi.hoisted(() => ({
  configure: vi.fn(async () => {}),
  getProducts: vi.fn(async () => ({ products: fake.products })),
  purchaseProduct: vi.fn(async (opts: Record<string, unknown>) => fake.buy!(opts)),
  getPurchases: vi.fn(async () => ({ purchases: fake.purchases })),
}));
vi.mock('@capacitor/app', () => ({ App: { getInfo: async () => ({ id: 'com.carromadda.app' }) } }));
vi.mock('@capgo/native-purchases', () => ({ NativePurchases: plugin, PURCHASE_TYPE: { INAPP: 'inapp', SUBS: 'subs' } }));

const { billingSupported, loadPacks, purchasePack, resetBillingForTest, unfinishedPurchases } = await import('./billing');

describe('billing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetBillingForTest();
    Object.assign(platform, { native: true, name: 'android' });
    fake.products = [];
    fake.purchases = [];
    fake.buy = async () => ({ purchaseToken: 'tok-1', packageName: 'com.carromadda.app' });
  });

  it('IAP-6 web: billing off, every call a no-op', async () => {
    Object.assign(platform, { native: false, name: 'web' });
    expect(billingSupported()).toBe(false);
    expect(await loadPacks()).toEqual([]);
    expect(await purchasePack('coins_500', 'u1')).toBeNull();
    expect(await unfinishedPurchases('u1')).toEqual([]);
    expect(plugin.getProducts).not.toHaveBeenCalled();
    expect(plugin.purchaseProduct).not.toHaveBeenCalled();
  });

  it('IAP-1 packs show the store price, in our order, only those the store has', async () => {
    fake.products = [
      { identifier: 'coins_2600', priceString: '৳1,100.00' },
      { identifier: 'coins_500', priceString: '৳250.00' },
      { identifier: 'something_else', priceString: '৳1.00' },
    ];
    expect(await loadPacks()).toEqual([
      { productId: 'coins_500', coins: 500, price: '৳250.00' },
      { productId: 'coins_2600', coins: 2600, price: '৳1,100.00' },
    ]);
    expect(plugin.configure).toHaveBeenCalledWith({ autoFinishTransactions: false });
    plugin.getProducts.mockRejectedValueOnce(new Error('no store'));
    expect(await loadPacks()).toEqual([]);
  });

  it('IAP-2 buying hands back the token; the server, not the plugin, finishes the purchase', async () => {
    expect(await purchasePack('coins_1200', 'u1')).toEqual({ productId: 'coins_1200', purchaseToken: 'tok-1', packageName: 'com.carromadda.app' });
    expect(plugin.purchaseProduct).toHaveBeenCalledWith(expect.objectContaining({
      productIdentifier: 'coins_1200', productType: 'inapp', appAccountToken: 'u1',
      isConsumable: false, autoAcknowledgePurchases: false,
    }));
    fake.buy = async () => { throw new Error('USER_CANCELED'); };
    expect(await purchasePack('coins_1200', 'u1')).toBeNull();
  });

  it('IAP-4 HAPP-9 unfinished purchases: this account\'s coin packs with a token, tagged with the app package', async () => {
    fake.purchases = [
      { productIdentifier: 'coins_500', purchaseToken: 'a' },
      { productIdentifier: 'remove_ads', purchaseToken: 'b' },
      { productIdentifier: 'coins_2600' },
      { productIdentifier: 'coins_2600', purchaseToken: 'c' },
    ];
    expect(await unfinishedPurchases('u1')).toEqual([
      { productId: 'coins_500', purchaseToken: 'a', packageName: 'com.carromadda.app' },
      { productId: 'coins_2600', purchaseToken: 'c', packageName: 'com.carromadda.app' },
    ]);
    expect(plugin.getPurchases).toHaveBeenCalledWith({ productType: 'inapp', appAccountToken: 'u1' });
  });
});
