import { useSyncExternalStore } from 'react';

/**
 * APP-9: screens that can't work without the server. Same-device and Vs-bot
 * need no network. A running online lobby or game is left alone: a short drop
 * there is handled by the room's own reconnect, not by swapping the screen.
 */
const NEEDS_NETWORK: readonly string[] = ['/online', '/ranked', '/leaderboard', '/login', '/register'];

export function needsNetwork(path: string): boolean {
  return NEEDS_NETWORK.includes(path) || path.startsWith('/join/');
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
