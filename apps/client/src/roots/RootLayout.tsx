import { useEffect } from 'react';
import { Outlet } from 'react-router';
import { Header } from '@/components/Header';
import { Toaster } from '@/components/ui/sonner';
import { t, useLang } from '@/i18n/t';

/**
 * UI-5: full-height column. Pages scroll inside <main>; the board page fills
 * it exactly (flex-1) so it never scrolls. Phone first, centred on desktop.
 */
export function RootLayout() {
  const lang = useLang();
  useEffect(() => {
    document.documentElement.lang = lang;
    document.title = t('app.title');
  }, [lang]);

  return (
    <div className="flex h-dvh flex-col">
      <Header />
      <main className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto flex min-h-full w-full max-w-3xl flex-col p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <Outlet />
        </div>
      </main>
      <Toaster />
    </div>
  );
}
