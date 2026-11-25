import { useEffect } from 'react';
import { BookOpen, Coins, Home, LogIn, Play, Settings, Sparkles, Store, Users, type LucideIcon } from 'lucide-react';
import { Link, NavLink } from 'react-router';
import { toast } from 'sonner';
import { Avatar } from '@/components/Avatar';
import { Button } from '@/components/ui/button';
import { useAppName } from '@/games/appName';
import { useGames } from '@/games/GamesContext';
import { gamePath, type ClientGame } from '@/games/types';
import { setLang, t, useLang } from '@/i18n/t';
import { cn } from '@/lib/utils';
import { claimDailyBonus } from '@/store/shopSlice';
import { useAppDispatch, useAppSelector } from '@/store/store';

interface NavItem { to: string; key: string; Icon: LucideIcon; end: boolean }

/** HAPP-3 the hub: home, adda (ADDA-2), shop, settings. A one-game app adds its play menu and how-to-play. */
function navLinks(single: ClientGame | null): NavItem[] {
  const links: NavItem[] = [{ to: '/', key: 'nav.home', Icon: Home, end: true }];
  if (single) links.push({ to: gamePath(single.id), key: 'nav.play', Icon: Play, end: false });
  links.push({ to: '/groups', key: 'nav.adda', Icon: Users, end: false });
  links.push({ to: '/shop', key: 'nav.shop', Icon: Store, end: false });
  if (single?.routes.howToPlay) links.push({ to: gamePath(single.id, 'how-to-play'), key: 'nav.howTo', Icon: BookOpen, end: false });
  links.push({ to: '/settings', key: 'nav.settings', Icon: Settings, end: false });
  return links;
}

/** COS-2: users whose daily bonus this page load has already asked for. */
const bonusAsked = new Set<string>();

/** App bar: app name (HAPP-4), icon nav (labels from sm up), coin balance, quick language switch. */
export function Header() {
  const lang = useLang();
  const other = lang === 'bn' ? 'en' : 'bn';
  const user = useAppSelector((s) => s.auth.user);
  const account = user ? t('nav.profile') : t('nav.login');
  const dispatch = useAppDispatch();
  const appName = useAppName();
  const links = navLinks(useGames().single);
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
    <header className="sticky top-0 z-30 flex items-center gap-1 border-b border-white/10 bg-background/60 px-3 py-2 pt-[max(0.5rem,var(--inset-top))] backdrop-blur-xl">
      <Link to="/" className="group mr-auto flex min-w-0 items-center gap-2">
        <span className="grid size-8 shrink-0 sm:size-9 place-items-center rounded-xl bg-linear-to-br from-amber-300 via-orange-500 to-fuchsia-600 shadow-[0_3px_0_#7c2d12] transition group-hover:rotate-6">
          <Sparkles className="size-5 text-white" />
        </span>
        <span className="truncate bg-linear-to-r from-amber-200 via-orange-200 to-pink-200 bg-clip-text font-display text-lg font-extrabold sm:text-xl tracking-tight text-transparent">{appName}</span>
      </Link>
      <nav className="flex gap-0 text-sm sm:gap-0.5">
        {links.map(({ to, key, Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            aria-label={t(key)}
            title={t(key)}
            className={({ isActive }) => cn(
              'flex items-center gap-1.5 rounded-xl px-1.5 py-2 text-white/75 sm:px-2 transition hover:bg-white/10 hover:text-white',
              isActive && 'bg-white/10 text-amber-200',
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
          className="ml-1 flex items-center gap-1 rounded-full bg-linear-to-b from-amber-300/25 to-orange-500/20 py-1 pr-2.5 pl-1 text-sm font-bold text-amber-100 tabular-nums ring-1 ring-amber-300/40 transition hover:ring-amber-300"
        >
          <span className="grid size-6 place-items-center rounded-full bg-linear-to-b from-amber-300 to-amber-500 shadow-inner"><Coins className="size-3.5 text-amber-900" /></span>{user.coins}
        </Link>
      )}
      <NavLink
        to={user ? '/profile' : '/login'}
        aria-label={account}
        title={account}
        data-testid="nav-account"
        className={({ isActive }) => cn(
          'flex items-center rounded-full p-1 transition hover:bg-white/10',
          isActive && 'ring-2 ring-amber-300',
        )}
      >
        {user ? <Avatar index={user.avatar} name={user.name} size="sm" /> : <LogIn className="size-5" />}
      </NavLink>
      <Button variant="outline" size="sm" className="ml-1 rounded-full px-2.5" onClick={() => setLang(other)} lang={other} aria-label={t(`lang.${other}`)} title={t(`lang.${other}`)}>
        {t(`lang.short.${other}`)}
      </Button>
    </header>
  );
}
