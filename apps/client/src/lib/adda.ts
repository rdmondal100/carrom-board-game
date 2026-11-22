import type { Presence } from '@carrom/protocol';
import { DEFAULT_HUB_URL } from '@/constants/brand';
import { isMatchPath } from './backButton';
import { isNative } from './native';

const HUB_URL = ((import.meta.env.VITE_HUB_URL as string | undefined) ?? '').trim().replace(/\/+$/, '') || DEFAULT_HUB_URL;

/**
 * ADDA-2 a group invite link (`/a/:code`). It opens on the web like room
 * invites; inside the apps the page origin is https://localhost, so the web
 * hub's URL is used there.
 */
export function groupInviteUrl(code: string, native = isNative(), origin = window.location.origin): string {
  return `${native ? HUB_URL : origin}/a/${code}`;
}

/** ADDA-1 the game this path is a running match of (what presence reports), or null in the menus. */
export function presenceGame(path: string): string | null {
  if (!isMatchPath(path)) return null;
  return /^\/g\/([^/]+)\//.exec(path)?.[1] ?? null;
}

/** i18n key and values for a presence line. */
export function presenceText(p: Presence): { key: string; game?: string } {
  if (p.state === 'game') return { key: 'adda.status.game', game: p.game };
  return { key: p.state === 'menu' ? 'adda.status.menu' : 'adda.status.offline' };
}

/** ROOM-11 style: the Web Share API where there is one, else the clipboard. True when shared or copied. */
export async function shareLink(url: string, title: string, text: string): Promise<'shared' | 'copied' | 'failed'> {
  if (typeof navigator.share === 'function') {
    try {
      await navigator.share({ title, text, url });
      return 'shared';
    } catch {
      // Cancelled: fall back to copying.
    }
  }
  try {
    await navigator.clipboard.writeText(url);
    return 'copied';
  } catch {
    return 'failed';
  }
}
