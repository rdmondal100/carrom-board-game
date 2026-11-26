import { useCallback, useSyncExternalStore } from 'react';
import { toast } from 'sonner';
import type { GameId } from '@hub/game-kit';
import { t } from '@/i18n/t';
import { setGameView, type View } from '@/store/settingsSlice';
import { useAppDispatch, useAppSelector } from '@/store/store';
import { deviceMemory, resolveView, webglSupported } from './support';

/** T3D-2 games whose 3D view failed this session (they show 2D until the page reloads). */
const broken = new Set<GameId>();
const listeners = new Set<() => void>();
const subscribe = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };

/** T3D-2 a 3D view could not start (no WebGL context, context lost): fall back to 2D, keep the choice. */
export function markBroken(game: GameId): void {
  if (broken.has(game)) return;
  broken.add(game);
  toast(t('view.failed'));
  listeners.forEach((l) => l());
}

/**
 * T3D-1 the board view of one game. `view` is what to draw now; `want` is the
 * player's choice (or the device default); `supported` = WebGL works here.
 */
export function useGameView(game: GameId): {
  view: View; want: View; supported: boolean; setView: (v: View) => void; failed: () => void;
} {
  const dispatch = useAppDispatch();
  const chosen = useAppSelector((s) => s.settings.view[game]);
  const isBroken = useSyncExternalStore(subscribe, () => broken.has(game), () => false);
  const supported = webglSupported();
  const want = chosen ?? resolveView(undefined, true, deviceMemory());
  const view = isBroken ? '2d' : resolveView(chosen, supported, deviceMemory());
  const setView = useCallback((v: View) => dispatch(setGameView({ game, view: v })), [dispatch, game]);
  const failed = useCallback(() => markBroken(game), [game]);
  return { view, want, supported, setView, failed };
}
