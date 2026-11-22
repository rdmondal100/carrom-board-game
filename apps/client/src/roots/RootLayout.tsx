import { useEffect, useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router';
import { usePurchaseRecovery } from '@/components/CoinPacks';
import { AddaController, NextGameBar } from '@/components/AddaController';
import { Header } from '@/components/Header';
import { OfflineNotice } from '@/components/OfflineNotice';
import { VoiceController } from '@/components/VoiceController';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Toaster } from '@/components/ui/sonner';
import { useAppName } from '@/games/appName';
import { t, useLang } from '@/i18n/t';
import { initAds, setMenuBanner } from '@/lib/ads';
import { getToken } from '@/lib/auth';
import { decideBack, isMatchPath, requestPause } from '@/lib/backButton';
import { exitApp, onHardwareBack, setMatchMode } from '@/lib/native';
import { needsNetwork, useOnline } from '@/lib/offline';
import { loadMe } from '@/store/authSlice';
import { useAppDispatch } from '@/store/store';

const OPEN_DIALOG = '[role="dialog"][data-state="open"], [role="alertdialog"][data-state="open"]';

/** react-router keeps its own history index; above 0 there is a page to go back to. */
const canGoBack = (): boolean => ((window.history.state as { idx?: number } | null)?.idx ?? 0) > 0;

/** Radix dialogs close on Escape, the same way the back button should close them. */
const closeDialog = (): void => {
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
};

/**
 * UI-5: full-height column. Pages scroll inside <main>; the board page fills
 * it exactly (flex-1) so it never scrolls. Phone first, centred on desktop.
 * APP-2/3/4/9: Android back button, match mode, safe areas, offline screens.
 */
export function RootLayout() {
  const lang = useLang();
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const online = useOnline();
  const [askExit, setAskExit] = useState(false);
  const inMatch = isMatchPath(pathname);
  const appName = useAppName();

  // AUTH-9: a saved token → load who it belongs to.
  useEffect(() => {
    if (getToken() !== null) void dispatch(loadMe());
  }, [dispatch]);
  useEffect(() => {
    document.documentElement.lang = lang;
    document.title = appName;
  }, [lang, appName]);

  // AD-2: consent first (Android only; a no-op on the web). No ad shows at start (AD-4).
  useEffect(() => { void initAds(); }, []);
  // AD-5: the optional menu banner never shows on a match screen.
  useEffect(() => { void setMenuBanner(!inMatch); }, [inMatch]);
  // IAP-4: purchases Play still holds (pending, or never verified) are sent again once signed in.
  usePurchaseRecovery();

  // APP-2: immersive + screen awake only while a match screen is open.
  useEffect(() => {
    setMatchMode(inMatch);
    return () => setMatchMode(false);
  }, [inMatch]);

  // APP-3: hardware back (Android app only).
  useEffect(() => onHardwareBack(() => {
    const action = decideBack({ path: window.location.pathname, dialogOpen: document.querySelector(OPEN_DIALOG) !== null, canGoBack: canGoBack() });
    if (action === 'closeDialog') closeDialog();
    else if (action === 'pause') requestPause();
    else if (action === 'confirmExit') setAskExit(true);
    else if (action === 'back') void navigate(-1);
    else void navigate('/', { replace: true });
  }), [navigate]);

  return (
    <div className="flex h-dvh flex-col pr-[var(--inset-right)] pl-[var(--inset-left)]">
      <Header />
      <main className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto flex min-h-full w-full max-w-3xl flex-col p-4 pb-[max(1rem,var(--inset-bottom))]">
          {!online && needsNetwork(pathname) ? <OfflineNotice /> : <Outlet />}
        </div>
      </main>
      <Toaster />
      <VoiceController />
      <AddaController />
      <NextGameBar />
      {askExit && (
        <Dialog open onOpenChange={(o) => { if (!o) setAskExit(false); }}>
          <DialogContent className="max-w-xs p-6">
            <DialogHeader><DialogTitle>{t('exit.title', { app: appName })}</DialogTitle></DialogHeader>
            <DialogFooter className="flex-row justify-end gap-2">
              <Button variant="outline" onClick={() => setAskExit(false)}>{t('exit.cancel')}</Button>
              <Button variant="destructive" onClick={exitApp}>{t('exit.confirm')}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
