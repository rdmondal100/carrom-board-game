import { useEffect } from 'react';
import { BookOpen, Coins, Home, LogIn, Play, Settings, Store } from 'lucide-react';
import { Link, NavLink } from 'react-router';
import { toast } from 'sonner';
import { Avatar } from '@/components/Avatar';
import { Button } from '@/components/ui/button';
import { setLang, t, useLang } from '@/i18n/t';
import { cn } from '@/lib/utils';
import { claimDailyBonus } from '@/store/shopSlice';
import { useAppDispatch, useAppSelector } from '@/store/store';

const LINKS = [
  { to: '/', key: 'nav.home', Icon: Home, end: true },
  { to: '/play', key: 'nav.play', Icon: Play, end: false },
  { to: '/shop', key: 'nav.shop', Icon: Store, end: false },
  { to: '/how-to-play', key: 'nav.howTo', Icon: BookOpen, end: false },
  { to: '/settings', key: 'nav.settings', Icon: Settings, end: false },
] as const;

/** COS-2: users whose daily bonus this page load has already asked for. */
const bonusAsked = new Set<string>();

/** App bar: title, icon nav (labels from sm up), coin balance, quick language switch. */
export function Header() {
  const lang = useLang();
  const other = lang === 'bn' ? 'en' : 'bn';
  const user = useAppSelector((s) => s.auth.user);
  const account = user ? t('nav.profile') : t('nav.login');
  const dispatch = useAppDispatch();
  const userId = user?.id;
  // COS-2: claim today's login bonus once per page load (the server gives it once per day).
  useEffect(() => {
    if (!userId || bonusAsked.has(userId)) return;
    bonusAsked.add(userId);
    dispatch(claimDailyBonus()).unwrap()
      .then((coins) => { if (coins > 0) toast.success(t('reward.daily', { coins })); })
      .catch(() => { bonusAsked.delete(userId); });
  }, [dispatch, userId]);
  return (
    <header className="flex items-center gap-1 border-b border-border px-3 py-2 pt-[max(0.5rem,var(--inset-top))]">
      <Link to="/" className="mr-auto text-lg font-bold tracking-tight">{t('app.title')}</Link>
      <nav className="flex gap-0.5 text-sm">
        {LINKS.map(({ to, key, Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            aria-label={t(key)}
            title={t(key)}
            className={({ isActive }) => cn(
              'flex items-center gap-1.5 rounded-md px-2 py-2 hover:bg-accent',
              isActive && 'bg-accent text-accent-foreground',
            )}
          >
            <Icon className="size-5" />
            <span className="hidden sm:inline">{t(key)}</span>
          </NavLink>
        ))}
      </nav>
      {user && (
        <Link
          to="/shop"
          data-testid="nav-coins"
          aria-label={t('header.coins', { coins: user.coins })}
          title={t('header.coins', { coins: user.coins })}
          className="flex items-center gap-1 rounded-md px-2 py-1.5 text-sm font-semibold tabular-nums hover:bg-accent"
        >
          <Coins className="size-4 text-amber-400" />{user.coins}
        </Link>
      )}
      <NavLink
        to={user ? '/profile' : '/login'}
        aria-label={account}
        title={account}
        data-testid="nav-account"
        className={({ isActive }) => cn(
          'flex items-center rounded-md p-1.5 hover:bg-accent',
          isActive && 'bg-accent text-accent-foreground',
        )}
      >
        {user ? <Avatar index={user.avatar} name={user.name} size="sm" /> : <LogIn className="size-5" />}
      </NavLink>
      <Button variant="outline" size="sm" onClick={() => setLang(other)} lang={other}>
        {t(`lang.${other}`)}
      </Button>
    </header>
  );
}
