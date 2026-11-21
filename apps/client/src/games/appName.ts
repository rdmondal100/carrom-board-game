import { GAME_APP_NAMES, HUB_NAME, type LocalName } from '@/constants/brand';
import { getLang, useLang } from '@/i18n/t';
import { useGames } from './GamesContext';
import type { ClientGame } from './types';

/** HAPP-4 the hub's name, or the one game's app name in a one-game build. */
export function appNameOf(single: ClientGame | null): LocalName {
  return (single && GAME_APP_NAMES[single.id]) || HUB_NAME;
}

/** HAPP-4 this app's name in the current language (re-renders on a language change). */
export function useAppName(): string {
  const lang = useLang();
  return appNameOf(useGames().single)[lang];
}

/** Same, outside React (current language). */
export const appNameNow = (single: ClientGame | null): string => appNameOf(single)[getLang()];
