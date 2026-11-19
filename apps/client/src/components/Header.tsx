import { BookOpen, Home, LogIn, Play, Settings } from 'lucide-react';
import { Link, NavLink } from 'react-router';
import { Avatar } from '@/components/Avatar';
import { Button } from '@/components/ui/button';
import { setLang, t, useLang } from '@/i18n/t';
import { cn } from '@/lib/utils';
import { useAppSelector } from '@/store/store';

const LINKS = [
  { to: '/', key: 'nav.home', Icon: Home, end: true },
  { to: '/play', key: 'nav.play', Icon: Play, end: false },
  { to: '/how-to-play', key: 'nav.howTo', Icon: BookOpen, end: false },
  { to: '/settings', key: 'nav.settings', Icon: Settings, end: false },
] as const;

/** App bar: title, icon nav (labels from sm up), quick language switch. */
export function Header() {
  const lang = useLang();
  const other = lang === 'bn' ? 'en' : 'bn';
  const user = useAppSelector((s) => s.auth.user);
  const account = user ? t('nav.profile') : t('nav.login');
  return (
    <header className="flex items-center gap-1 border-b border-border px-3 py-2 pt-[max(0.5rem,env(safe-area-inset-top))]">
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
