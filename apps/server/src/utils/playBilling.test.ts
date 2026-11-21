import { describe, expect, it, vi } from 'vitest';
import { googlePlayBilling, type Requester } from './playBilling.js';

const BASE = 'https://androidpublisher.googleapis.com/androidpublisher/v3/applications';

function requester(answer: (url: string, method: string) => unknown): Requester & { calls: string[] } {
  const calls: string[] = [];
  return {
    calls,
    request: vi.fn(async ({ url, method }) => {
      calls.push(`${method} ${url}`);
      return { data: answer(url, method) };
    }) as Requester['request'],
  };
}

function httpError(status: number): Error {
  return Object.assign(new Error(`HTTP ${status}`), { response: { status } });
}

describe('playBilling', () => {
  it('IAP-3 reads a purchase from the Play Developer API', async () => {
    const auth = requester(() => ({
      purchaseState: 0, consumptionState: 0, orderId: 'GPA.1', obfuscatedExternalAccountId: 'u1', productId: 'coins_500',
    }));
    const billing = googlePlayBilling(auth);
    expect(await billing.getProduct('com.carromadda.app', 'coins_500', 'tok/en')).toEqual({
      purchaseState: 0, consumptionState: 0, orderId: 'GPA.1', accountId: 'u1',
    });
    expect(auth.calls).toEqual([`GET ${BASE}/com.carromadda.app/purchases/products/coins_500/tokens/tok%2Fen`]);
  });

  it('IAP-3 consume posts to :consume', async () => {
    const auth = requester(() => ({}));
    await googlePlayBilling(auth).consume('com.carromadda.app', 'coins_1200', 'abc');
    expect(auth.calls).toEqual([`POST ${BASE}/com.carromadda.app/purchases/products/coins_1200/tokens/abc:consume`]);
  });

  it('IAP-3 unknown token or wrong product reads as null; other errors throw', async () => {
    for (const status of [400, 404, 410]) {
      const auth: Requester = { request: async () => { throw httpError(status); } };
      expect(await googlePlayBilling(auth).getProduct('com.x.y', 'coins_500', 't')).toBeNull();
    }
    const other = requester(() => ({ purchaseState: 0, productId: 'coins_2600' }));
    expect(await googlePlayBilling(other).getProduct('com.x.y', 'coins_500', 't')).toBeNull();
    const down: Requester = { request: async () => { throw httpError(503); } };
    await expect(googlePlayBilling(down).getProduct('com.x.y', 'coins_500', 't')).rejects.toThrow('HTTP 503');
  });

  it('IAP-3 missing optional fields get defaults', async () => {
    const auth = requester(() => ({ purchaseState: 2 }));
    expect(await googlePlayBilling(auth).getProduct('com.x.y', 'coins_500', 't'))
      .toEqual({ purchaseState: 2, consumptionState: 0, orderId: null, accountId: null });
  });
});
