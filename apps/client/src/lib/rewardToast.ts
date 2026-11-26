import { toast } from 'sonner';
import { t } from '@/i18n/t';
import type { GameRewardInfo } from '@/store/shopSlice';

/** COS-7 / PRG-8 the game-end reward toast: coins and XP, then a level-up line. Nothing when no coins were given. */
export function rewardToast(r: GameRewardInfo): void {
  if (r.coins <= 0) return;
  toast.success(r.xp ? t('reward.toastXp', { coins: r.coins, xp: r.xp }) : t('reward.toast', { coins: r.coins }));
  if (r.level) toast.success(t('reward.levelUp', { level: r.level, coins: r.levelCoins ?? 0 }));
}
