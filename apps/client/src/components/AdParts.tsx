import { useEffect, useRef, useState } from 'react';
import { Clapperboard } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { ADS } from '@/constants/ads';
import { t } from '@/i18n/t';
import { adsSupported, maybeInterstitial, noteGameFinished, showRewarded } from '@/lib/ads';
import { loadMe } from '@/store/authSlice';
import { adWatched, fetchAdStatus } from '@/store/shopSlice';
import { useAppDispatch, useAppSelector } from '@/store/store';

/**
 * AD-3 "watch an ad for 25 coins" (Android only, signed in, while today's
 * rewarded ads last). The server credits the coins when AdMob's SSV callback
 * arrives; the balance is re-read a moment later.
 */
export function RewardedAdButton({ className }: { className?: string }) {
  const dispatch = useAppDispatch();
  const userId = useAppSelector((s) => s.auth.user?.id ?? null);
  const left = useAppSelector((s) => s.shop.adsLeft);
  const [busy, setBusy] = useState(false);
  const supported = adsSupported();
  useEffect(() => {
    if (supported && userId) void dispatch(fetchAdStatus());
  }, [dispatch, supported, userId]);
  if (!supported || !userId || !left) return null;

  const watch = async () => {
    setBusy(true);
    const out = await showRewarded(userId);
    setBusy(false);
    if (out === 'earned') {
      dispatch(adWatched());
      toast.success(t('ads.rewardPending', { coins: ADS.rewardedCoins }));
      for (const ms of ADS.refreshAfterRewardMs) setTimeout(() => void dispatch(loadMe()), ms);
    } else {
      toast(t(out === 'closed' ? 'ads.notFinished' : 'ads.unavailable'));
    }
  };
  return (
    <Button variant="secondary" className={className} disabled={busy} onClick={() => void watch()} data-testid="rewarded-ad">
      <Clapperboard className="size-4" />{t('ads.watch', { coins: ADS.rewardedCoins, left })}
    </Button>
  );
}

/**
 * AD-4 on a game-end screen: counts the finished game once, and wraps the
 * screen's leave actions so a due interstitial shows (and closes) first.
 */
export function useGameEndAds(): { leaving: boolean; leave: (then: () => void) => void } {
  const counted = useRef(false);
  const [leaving, setLeaving] = useState(false);
  useEffect(() => {
    if (counted.current) return;
    counted.current = true;
    noteGameFinished();
  }, []);
  const leave = (then: () => void) => {
    if (leaving) return;
    setLeaving(true);
    void maybeInterstitial('gameEnd').finally(() => {
      setLeaving(false);
      then();
    });
  };
  return { leaving, leave };
}
