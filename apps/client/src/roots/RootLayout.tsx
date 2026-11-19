import { useEffect } from 'react';
import { NavLink, Outlet } from 'react-router';
import { LANGS, setLang, t, useLang } from '@/i18n/t';

const linkClass = ({ isActive }: { isActive: boolean }) =>
  `px-2 py-1 rounded ${isActive ? 'bg-amber-900/60' : 'hover:bg-amber-900/30'}`;

export function RootLayout() {
  const lang = useLang();
  useEffect(() => {
    document.documentElement.lang = lang;
    document.title = t('app.title');
  }, [lang]);

  return (
    <div className="min-h-full flex flex-col">
      <header className="flex flex-wrap items-center gap-2 px-4 py-2 border-b border-amber-900/50">
        <h1 className="font-bold text-lg mr-auto">{t('app.title')}</h1>
        <nav className="flex gap-1 text-sm">
          <NavLink to="/local/setup" className={linkClass}>{t('nav.local')}</NavLink>
          <NavLink to="/" end className={linkClass}>{t('nav.sandbox')}</NavLink>
          <NavLink to="/dev/determinism" className={linkClass}>{t('nav.determinism')}</NavLink>
        </nav>
        <div className="flex gap-1 text-sm">
          {LANGS.map((l) => (
            <button
              key={l}
              type="button"
              onClick={() => setLang(l)}
              className={`px-2 py-1 rounded border border-amber-900/50 ${l === lang ? 'bg-amber-900/60' : ''}`}
            >
              {t(`lang.${l}`)}
            </button>
          ))}
        </div>
      </header>
      <main className="flex-1 w-full max-w-3xl mx-auto p-4">
        <Outlet />
      </main>
    </div>
  );
}
