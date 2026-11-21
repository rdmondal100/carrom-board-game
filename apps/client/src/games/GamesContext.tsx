import { createContext, useContext, type ReactNode } from 'react';
import { BUILD_GAMES } from './registry';
import type { ClientGame } from './types';

interface Games {
  /** HAPP-3 the games in this build. */
  games: readonly ClientGame[];
  /** The one game of a one-game build (its own app), else null (the hub). */
  single: ClientGame | null;
}

const GamesCtx = createContext<Games>({ games: BUILD_GAMES, single: BUILD_GAMES.length === 1 ? BUILD_GAMES[0]! : null });
const GameCtx = createContext<ClientGame | null>(null);

/** Tests pass their own list; the app uses BUILD_GAMES. */
export function GamesProvider({ games, children }: { games: readonly ClientGame[]; children: ReactNode }) {
  return <GamesCtx value={{ games, single: games.length === 1 ? games[0]! : null }}>{children}</GamesCtx>;
}

export const useGames = (): Games => useContext(GamesCtx);

export function gameIn(games: readonly ClientGame[], id: string | undefined): ClientGame | undefined {
  return games.find((g) => g.id === id);
}

/** The game of the `/g/:gameId/*` page being shown. */
export function GameProvider({ game, children }: { game: ClientGame; children: ReactNode }) {
  return <GameCtx value={game}>{children}</GameCtx>;
}

export function useGame(): ClientGame {
  const g = useContext(GameCtx);
  if (!g) throw new Error('useGame outside a /g/:gameId page');
  return g;
}
