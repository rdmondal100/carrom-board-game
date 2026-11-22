import { useSyncExternalStore } from 'react';
import { gamePageOf } from './gamePage';

/**
 * APP-9: screens that can't work without the server. Same-device and Vs-bot
 * need no network. A running online lobby or game is left alone: a short drop
 * there is handled by the room's own reconnect, not by swapping the screen.
 */
const NEEDS_NETWORK: readonly string[] = ['/login', '/register', '/shop'];
/** HAPP-2 a game's pages that need the server: `/g/:gameId/<page>`. */
const GAME_NEEDS_NETWORK: readonly string[] = ['online', 'ranked', 'leaderboard'];

export function needsNetwork(path: string): boolean {
  const page = gamePageOf(path);
  if (page !== null) return GAME_NEEDS_NETWORK.includes(page);
  // ADDA-1..3 friends, groups and group invites are online-only too.
  return NEEDS_NETWORK.includes(path) || ['/join/', '/a/', '/groups', '/friends'].some((p) => path.startsWith(p));
}

function subscribe(cb: () => void): () => void {
  window.addEventListener('online', cb);
  window.addEventListener('offline', cb);
  return () => {
    window.removeEventListener('online', cb);
    window.removeEventListener('offline', cb);
  };
}

/** Follows navigator.onLine; the page updates by itself when the network comes back. */
export function useOnline(): boolean {
  return useSyncExternalStore(subscribe, () => navigator.onLine, () => true);
}
