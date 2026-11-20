import { useEffect, useState } from 'react';
import { Coins, Smartphone } from 'lucide-react';
import { toast } from 'sonner';
import { IAP_PACKS, type IapProductId, type IapVerifyRequest } from '@carrom/protocol';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { t } from '@/i18n/t';
import { billingSupported, loadPacks, purchasePack, unfinishedPurchases, type StorePack } from '@/lib/billing';
import { shopErrorKey, verifyPurchase, type ShopFailure } from '@/store/shopSlice';
import { useAppDispatch, useAppSelector, type AppDispatch } from '@/store/store';

/** Send one purchase to the server and say what happened. */
async function sendPurchase(dispatch: AppDispatch, req: IapVerifyRequest, quietFailure = false): Promise<void> {
  try {
    const out = await dispatch(verifyPurchase(req)).unwrap();
    if (out.status === 'pending') toast(t('iap.pending'));
    else if (out.credited > 0) toast.success(t('iap.credited', { coins: out.credited }));
  } catch (err) {
    if (quietFailure) return;
    const f = err as ShopFailure;
    const key = shopErrorKey(f);
    toast.error(key ? t(key) : f.error);
  }
}

/** IAP-4: users already checked this page load (one retry pass per account). */
const recovered = new Set<string>();

/**
 * IAP-4: on app start (once signed in), send purchases Play still holds —
 * pending ones that have since completed, or a verify that never arrived.
 * Failures stay quiet; the next start tries again.
 */
export function usePurchaseRecovery(): void {
  const dispatch = useAppDispatch();
  const userId = useAppSelector((s) => s.auth.user?.id ?? null);
  useEffect(() => {
    if (!userId || !billingSupported() || recovered.has(userId)) return;
    recovered.add(userId);
    void (async () => {
      for (const req of await unfinishedPurchases(userId)) await sendPurchase(dispatch, req, true);
    })();
  }, [dispatch, userId]);
}

/** For tests: forget which users were checked. */
export function resetRecoveryForTest(): void {
  recovered.clear();
}

/** IAP-1/2/6: coin packs. Android: the store's prices and Play's purchase sheet. Web: a pointer to the app. */
export function CoinPacks({ userId }: { userId: string }) {
  const dispatch = useAppDispatch();
  const supported = billingSupported();
  const [packs, setPacks] = useState<StorePack[] | null>(null);
  const [busy, setBusy] = useState<IapProductId | null>(null);
  useEffect(() => {
    if (supported) void loadPacks().then(setPacks);
  }, [supported]);

  const buy = async (productId: IapProductId) => {
    setBusy(productId);
    try {
      const req = await purchasePack(productId, userId);
      if (req) await sendPurchase(dispatch, req);
      else toast(t('iap.notCompleted'));
    } finally {
      setBusy(null);
    }
  };

  return (
    <Card className="flex flex-col gap-3 p-3" data-testid="coin-packs">
      <h3 className="flex items-center gap-2 font-semibold"><Coins className="size-4 text-amber-400" />{t('iap.title')}</h3>
      {!supported ? (
        <>
          <ul className="flex flex-wrap gap-2 text-sm text-muted-foreground">
            {IAP_PACKS.map((p) => <li key={p.productId} className="rounded-md bg-muted px-2 py-1 tabular-nums">{t('iap.pack', { coins: p.coins })}</li>)}
          </ul>
          <p className="flex items-center gap-2 text-sm" data-testid="iap-android-only">
            <Smartphone className="size-4 shrink-0" />{t('iap.androidOnly')}
          </p>
        </>
      ) : packs === null ? (
        <p className="text-sm text-muted-foreground">{t('iap.loading')}</p>
      ) : packs.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('iap.none')}</p>
      ) : (
        <ul className="grid grid-cols-3 gap-2">
          {packs.map((p) => (
            <li key={p.productId}>
              <Button
                variant="outline"
                className="h-auto w-full flex-col gap-0.5 py-2"
                disabled={busy !== null}
                onClick={() => void buy(p.productId)}
                data-testid={`iap-${p.productId}`}
              >
                <span className="font-semibold tabular-nums">{t('iap.pack', { coins: p.coins })}</span>
                <span className="text-xs text-muted-foreground">{p.price}</span>
              </Button>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
