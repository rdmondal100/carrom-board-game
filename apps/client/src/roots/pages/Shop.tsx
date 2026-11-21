import { Suspense, useEffect, useState, type ReactNode } from 'react';
import { Check, Coins, Store } from 'lucide-react';
import { Link } from 'react-router';
import { toast } from 'sonner';
import {
  COSMETICS, GAME_SLOTS, itemsForGame, type CosmeticGame, type CosmeticItem, type PublicUser,
} from '@carrom/protocol';
import { RewardedAdButton } from '@/components/AdParts';
import { CoinPacks } from '@/components/CoinPacks';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useGames } from '@/games/GamesContext';
import { isPlayable, type ClientGame } from '@/games/types';
import { t, useLang } from '@/i18n/t';
import { cn } from '@/lib/utils';
import { buyItem, clearShopError, equipItems, shopErrorKey } from '@/store/shopSlice';
import { useAppDispatch, useAppSelector } from '@/store/store';

const RARITY_CLASS: Record<CosmeticItem['rarity'], string> = {
  common: 'text-muted-foreground', rare: 'text-sky-400', epic: 'text-fuchsia-400', legendary: 'text-amber-400',
};

/** COS-7 / HAPP-5: the shop. A tab per game (+ "All games"), tabs per slot, a preview, price, buy and equip. One wallet. */
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

/** HAPP-5 'any' = the "All games" tab (items that fit every game with that slot). */
type ShopTab = CosmeticGame | 'any';

function Tabs<T extends string>({ items, value, onPick, label, testId, cols }: {
  items: readonly T[]; value: T; onPick: (v: T) => void; label: (v: T) => ReactNode; testId: string; cols?: boolean;
}) {
  return (
    <div role="tablist" className={cn('gap-1 rounded-lg bg-muted p-1', cols ? 'grid grid-cols-3' : 'flex overflow-x-auto')}>
      {items.map((v) => (
        <button
          key={v}
          type="button"
          role="tab"
          aria-selected={value === v}
          data-testid={`${testId}-${v}`}
          onClick={() => onPick(v)}
          className={cn('flex shrink-0 items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-sm',
            value === v ? 'bg-background font-semibold shadow' : 'text-muted-foreground')}
        >
          {label(v)}
        </button>
      ))}
    </div>
  );
}

/** The game's preview with `slots`, or nothing for a game without one. */
function Preview({ game, slots, className }: { game: ClientGame | undefined; slots: Readonly<Record<string, string>>; className?: string }) {
  const P = game?.CosmeticPreview;
  if (!P) return null;
  return <Suspense fallback={<div className={className} />}><P equipped={slots} className={className} /></Suspense>;
}

const slotsOf = (tab: ShopTab): readonly string[] => (tab === 'any' ? [] : GAME_SLOTS[tab]);

function ShopFor({ user }: { user: PublicUser }) {
  const dispatch = useAppDispatch();
  const { games } = useGames();
  const { busy, error } = useAppSelector((s) => s.shop);
  const shopGames = games.filter((g) => isPlayable(g) && g.CosmeticPreview);
  const tabs: ShopTab[] = [...shopGames.map((g) => g.id), 'any'];
  const [tab, setTab] = useState<ShopTab>(tabs[0]!);
  const game = shopGames.find((g) => g.id === tab);
  const slotList = slotsOf(tab);
  const [slot, setSlot] = useState<string>(slotList[0] ?? '');
  const { owned } = user.cosmetics;
  const equippedOf = (x: ShopTab): Readonly<Record<string, string>> => (x === 'any' ? {} : user.cosmetics.equipped[x]);
  const equipped = equippedOf(tab);
  const list = tab === 'any' ? COSMETICS.filter((c) => c.game === 'any') : itemsForGame(tab).filter((c) => c.type === slot);
  const [picked, setPicked] = useState<string | undefined>(equipped[slot]);
  const item: CosmeticItem | undefined = list.find((c) => c.id === picked) ?? list.find((c) => c.id === equipped[slot]) ?? list[0];

  useEffect(() => {
    if (!error) return;
    const key = shopErrorKey(error);
    toast.error(key ? t(key) : error.error);
    dispatch(clearShopError());
  }, [dispatch, error]);

  const openTab = (next: ShopTab) => {
    const first = slotsOf(next)[0] ?? '';
    setTab(next);
    setSlot(first);
    setPicked(equippedOf(next)[first]);
  };
  const openSlot = (next: string) => {
    setSlot(next);
    setPicked(equipped[next]);
  };
  const isOwned = item !== undefined && owned.includes(item.id);
  const isEquipped = item !== undefined && equipped[item.type] === item.id;
  const buy = () => {
    if (!item) return;
    void dispatch(buyItem(item.id)).unwrap().then(() => toast.success(t('shop.bought', { name: t(`item.${item.id}`) }))).catch(() => {});
  };
  const equip = () => {
    if (item && tab !== 'any') void dispatch(equipItems({ game: tab, [item.type]: item.id }));
  };
  const tabLabel = (v: ShopTab) => {
    const g = shopGames.find((x) => x.id === v);
    return g ? <><g.Icon className="size-4" />{t(g.nameKey)}</> : t('shop.allGames');
  };

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-xl font-bold"><Store className="size-5" />{t('shop.title')}</h2>
        <span data-testid="shop-balance" className="flex items-center gap-1 font-semibold tabular-nums">
          <Coins className="size-4 text-amber-400" />{user.coins}
        </span>
      </div>
      <Tabs items={tabs} value={tab} onPick={openTab} testId="shop-game" label={tabLabel} />
      {slotList.length > 0 && (
        <Tabs items={slotList} value={slot} onPick={openSlot} testId="shop-tab" cols label={(v) => t(`shop.tab.${v}`)} />
      )}
      {item && <Preview game={game} slots={{ ...equipped, [slot]: item.id }} className="mx-auto w-48" />}
      {item && (
        <Card className="flex items-center gap-3 p-3">
          <div className="min-w-0 flex-1">
            <p className="font-semibold">{t(`item.${item.id}`)}</p>
            <p className={cn('text-xs', RARITY_CLASS[item.rarity])}>{t(`shop.rarity.${item.rarity}`)}</p>
          </div>
          {isEquipped ? (
            <Button disabled variant="outline"><Check className="size-4" />{t('shop.equipped')}</Button>
          ) : isOwned && tab !== 'any' ? (
            <Button onClick={equip} disabled={busy !== null} data-testid="shop-equip">{t('shop.equip')}</Button>
          ) : isOwned ? (
            <Button disabled variant="outline">{t('shop.owned')}</Button>
          ) : (
            <Button onClick={buy} disabled={busy !== null || user.coins < item.price} data-testid="shop-buy">
              <Coins className="size-4" />{t('shop.buy', { price: item.price })}
            </Button>
          )}
        </Card>
      )}
      {list.length === 0 && <p className="text-center text-sm text-muted-foreground" data-testid="shop-empty">{t('shop.empty')}</p>}
      <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {list.map((c) => (
          <li key={c.id}>
            <button
              type="button"
              data-testid={`shop-item-${c.id}`}
              onClick={() => setPicked(c.id)}
              className={cn('flex w-full flex-col items-center gap-1 rounded-lg border p-2 text-sm',
                c.id === item?.id ? 'border-primary bg-primary/10' : 'border-border hover:bg-accent')}
            >
              <Preview game={game} slots={{ ...equipped, [slot]: c.id }} className="w-20" />
              <span className="truncate">{t(`item.${c.id}`)}</span>
              <span className="text-xs text-muted-foreground tabular-nums">
                {equipped[c.type] === c.id ? t('shop.equipped') : owned.includes(c.id) ? t('shop.owned') : `${c.price} ${t('shop.coins')}`}
              </span>
            </button>
          </li>
        ))}
      </ul>
      <CoinPacks userId={user.id} />
      <RewardedAdButton className="self-center" />
      <p className="text-center text-xs text-muted-foreground">{t('shop.earn')}</p>
    </div>
  );
}
