/**
 * HAPP-4: every app and brand name lives here and nowhere else (a test greps
 * for stray copies). The hub brand is not decided yet: HUB_NAME is a
 * placeholder. Plain data, no imports, so vite.config and capacitor.config can
 * read it too. Android launcher names per flavor are in android/app/build.gradle.
 */

export interface LocalName { en: string; bn: string }

/** Placeholder hub brand (the web and the all-games app) until the owner picks one. */
export const HUB_NAME: LocalName = { en: 'Adda Games', bn: 'আড্ডা গেমস' };

/** Each game's own Android app (and the one-game web build). */
export const GAME_APP_NAMES: Readonly<Record<string, LocalName>> = {
  carrom: { en: 'Carrom Adda', bn: 'ক্যারম আড্ডা' },
  ludo: { en: 'Ludo Adda', bn: 'লুডো আড্ডা' },
  callbreak: { en: 'Callbreak Adda', bn: 'কলব্রেক আড্ডা' },
  nodipar: { en: 'Nodi Par', bn: 'নদী পার' },
};

/** Where the web hub lives; "more games" in a one-game build links here. Set VITE_HUB_URL per deploy. */
export const DEFAULT_HUB_URL = 'https://example.invalid';

/** HAPP-3/4 the app's name for a VITE_APP_GAMES value: the hub for `all`, else that game's app. */
export function appNameFor(appGames: string | undefined): LocalName {
  const id = (appGames ?? '').trim();
  return GAME_APP_NAMES[id] ?? HUB_NAME;
}
