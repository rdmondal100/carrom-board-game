import { GAME_IDS } from '@hub/game-kit';
import { callbreak } from './callbreak';
import { carrom } from './carrom';
import { ludo } from './ludo';
import { nodipar } from './nodipar';
import type { ClientGame } from './types';

/** HAPP-1 every game the client knows, in hub order. */
export const ALL_GAMES: readonly ClientGame[] = [carrom, ludo, callbreak, nodipar];

/**
 * HAPP-3 the games of one build from VITE_APP_GAMES: `all` (or unset) = every
 * game (web and the hub app), or one game id (that game's own app).
 */
export function gamesFor(appGames: string | undefined): ClientGame[] {
  const v = (appGames ?? '').trim();
  if (v === '' || v === 'all') return [...ALL_GAMES];
  const game = ALL_GAMES.find((g) => g.id === v);
  if (!game) throw new Error(`VITE_APP_GAMES must be "all" or one of ${GAME_IDS.join(', ')} (got "${v}")`);
  return [game];
}

/** HAPP-3 this build's games. */
export const BUILD_GAMES: readonly ClientGame[] = gamesFor(import.meta.env.VITE_APP_GAMES);
