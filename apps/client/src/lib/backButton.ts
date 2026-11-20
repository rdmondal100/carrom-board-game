/** Screens that are a running match: back opens the pause menu, bars hide, screen stays on. */
export const MATCH_PATHS: readonly string[] = ['/local/play', '/online/game'];

export const isMatchPath = (path: string): boolean => MATCH_PATHS.includes(path);

/** What the screen looks like when the hardware back button is pressed. */
export interface BackState {
  /** Current route path, e.g. '/settings'. */
  path: string;
  /** A modal dialog (pause menu, confirm, …) is open. */
  dialogOpen: boolean;
  /** The app's own history has a page to go back to. */
  canGoBack: boolean;
}

export type BackAction = 'closeDialog' | 'pause' | 'confirmExit' | 'back' | 'home';

/**
 * APP-3: what the Android back button does. A dialog closes first (so in a
 * match the pause menu's back = resume); a match pauses; Home asks before
 * leaving the app; any other screen goes back, or Home when it was opened
 * directly (e.g. from an invite link).
 */
export function decideBack(s: BackState): BackAction {
  if (s.dialogOpen) return 'closeDialog';
  if (isMatchPath(s.path)) return 'pause';
  if (s.path === '/') return 'confirmExit';
  return s.canGoBack ? 'back' : 'home';
}

/** Event the match pages listen to: "back was pressed, open your pause menu". */
const PAUSE_EVENT = 'carrom:pause';

export function requestPause(): void {
  window.dispatchEvent(new Event(PAUSE_EVENT));
}

/** Subscribe to pause requests; returns the unsubscribe function (fits useEffect). */
export function onPauseRequest(cb: () => void): () => void {
  window.addEventListener(PAUSE_EVENT, cb);
  return () => window.removeEventListener(PAUSE_EVENT, cb);
}
