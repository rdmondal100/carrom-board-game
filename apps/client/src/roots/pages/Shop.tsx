import { useEffect, useState } from 'react';
import { Check, Coins, Store } from 'lucide-react';
import { Link } from 'react-router';
import { toast } from 'sonner';
import { COSMETIC_TYPES, COSMETICS, type CosmeticItem, type CosmeticType, type PublicUser } from '@carrom/protocol';
import { RewardedAdButton } from '@/components/AdParts';
import { SkinPreview } from '@/components/SkinPreview';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { t, useLang } from '@/i18n/t';
import { cn } from '@/lib/utils';
import { buyItem, clearShopError, equipItems, shopErrorKey } from '@/store/shopSlice';
import { useAppDispatch, useAppSelector } from '@/store/store';

const RARITY_CLASS: Record<CosmeticItem['rarity'], string> = {
  common: 'text-muted-foreground', rare: 'text-sky-400', epic: 'text-fuchsia-400', legendary: 'text-amber-400',
};

/** COS-7: the shop. Tabs per type, a preview on a mini board, price, buy and equip. */
export function Shop() {
  useLang();
  const { user, checked } = useAppSelector((s) => s.auth);
  if (!checked) return <p className="text-center text-muted-foreground">{t('auth.loading')}</p>;
  if (!user) {
    return (
      <Card className="mx-auto flex w-full max-w-sm flex-col items-center gap-3 p-6 text-center">
        <p>{t('shop.signInFirst')}</p>
        <Button asChild><Link to="/login?next=%2Fshop">{t('online.signIn')}</Link></Button>
      </Card>
    );
  }
  return <ShopFor user={user} />;
}

function ShopFor({ user }: { user: PublicUser }) {
  const dispatch = useAppDispatch();
  const { busy, error } = useAppSelector((s) => s.shop);
  const { equipped, owned } = user.cosmetics;
  const [tab, setTab] = useState<CosmeticType>('striker');
  const [picked, setPicked] = useState<string>(equipped.striker);
  const item = COSMETICS.find((c) => c.id === picked) ?? COSMETICS.find((c) => c.id === equipped[tab])!;
  const preview = { ...equipped, [tab]: item.id };

  useEffect(() => {
    if (!error) return;
    const key = shopErrorKey(error);
    toast.error(key ? t(key) : error.error);
    dispatch(clearShopError());
  }, [dispatch, error]);

  const openTab = (type: CosmeticType) => {
    setTab(type);
    setPicked(equipped[type]);
  };
  const isOwned = owned.includes(item.id);
  const isEquipped = equipped[item.type] === item.id;
  const buy = () => {
    void dispatch(buyItem(item.id)).unwrap().then(() => toast.success(t('shop.bought', { name: t(`item.${item.id}`) }))).catch(() => {});
  };
  const equip = () => { void dispatch(equipItems({ [item.type]: item.id })); };

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-xl font-bold"><Store className="size-5" />{t('shop.title')}</h2>
        <span data-testid="shop-balance" className="flex items-center gap-1 font-semibold tabular-nums">
          <Coins className="size-4 text-amber-400" />{user.coins}
        </span>
      </div>
      <div role="tablist" className="grid grid-cols-3 gap-1 rounded-lg bg-muted p-1">
        {COSMETIC_TYPES.map((type) => (
          <button
            key={type}
            type="button"
            role="tab"
            aria-selected={tab === type}
            data-testid={`shop-tab-${type}`}
            onClick={() => openTab(type)}
            className={cn('rounded-md px-3 py-1.5 text-sm', tab === type ? 'bg-background font-semibold shadow' : 'text-muted-foreground')}
          >
            {t(`shop.tab.${type}`)}
          </button>
        ))}
      </div>
      <SkinPreview board={preview.board} coins={preview.coins} striker={preview.striker} className="mx-auto w-48" />
      <Card className="flex items-center gap-3 p-3">
        <div className="min-w-0 flex-1">
          <p className="font-semibold">{t(`item.${item.id}`)}</p>
          <p className={cn('text-xs', RARITY_CLASS[item.rarity])}>{t(`shop.rarity.${item.rarity}`)}</p>
        </div>
        {isEquipped ? (
          <Button disabled variant="outline"><Check className="size-4" />{t('shop.equipped')}</Button>
        ) : isOwned ? (
          <Button onClick={equip} disabled={busy !== null} data-testid="shop-equip">{t('shop.equip')}</Button>
        ) : (
          <Button onClick={buy} disabled={busy !== null || user.coins < item.price} data-testid="shop-buy">
            <Coins className="size-4" />{t('shop.buy', { price: item.price })}
          </Button>
        )}
      </Card>
      <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {COSMETICS.filter((c) => c.type === tab).map((c) => (
          <li key={c.id}>
            <button
              type="button"
              data-testid={`shop-item-${c.id}`}
              onClick={() => setPicked(c.id)}
              className={cn('flex w-full flex-col items-center gap-1 rounded-lg border p-2 text-sm',
                c.id === item.id ? 'border-primary bg-primary/10' : 'border-border hover:bg-accent')}
            >
              <SkinPreview board={tab === 'board' ? c.id : equipped.board} coins={tab === 'coins' ? c.id : equipped.coins}
                striker={tab === 'striker' ? c.id : equipped.striker} className="w-20" />
              <span className="truncate">{t(`item.${c.id}`)}</span>
              <span className="text-xs text-muted-foreground tabular-nums">
                {equipped[c.type] === c.id ? t('shop.equipped') : owned.includes(c.id) ? t('shop.owned') : `${c.price} ${t('shop.coins')}`}
              </span>
            </button>
          </li>
        ))}
      </ul>
      <RewardedAdButton className="self-center" />
      <p className="text-center text-xs text-muted-foreground">{t('shop.earn')}</p>
    </div>
  );
}
