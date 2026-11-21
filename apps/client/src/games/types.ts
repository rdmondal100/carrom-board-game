import type { ComponentType, LazyExoticComponent } from 'react';
import type { GameId } from '@hub/game-kit';

export type { GameId };

/** HAPP-1 the ways to play, in menu order. A game turns each on or shows it as "coming soon". */
export type PlayModeId = 'local' | 'bot' | 'online' | 'ranked';
export const PLAY_MODES: readonly PlayModeId[] = ['local', 'bot', 'online', 'ranked'];

type Page = LazyExoticComponent<ComponentType>;

/** HAPP-1 a game's own screens, loaded on first use (`import()`), so other games' code stays out. */
export interface GameRoutes {
  /** `/g/:id/local/setup` (same device; `?vs=bot` for Vs bot). */
  setup: Page;
  /** `/g/:id/local/play` */
  localGame: Page;
  /** `/g/:id/online`: create or join a private room. */
  online: Page;
  /** `/g/:id/online/lobby` */
  lobby: Page;
  /** `/g/:id/online/game` (private and ranked rooms). */
  onlineGame: Page;
  /** `/g/:id/how-to-play` */
  howToPlay: Page;
}

/** HAPP-5 a shop preview of a game's look with these slot items. */
export interface CosmeticPreviewProps { equipped: Readonly<Record<string, string>>; className?: string }

/** A route only a developer needs (e.g. carrom's sandbox), at a top-level path. */
export interface DevRoute { path: string; labelKey: string; element: Page }

/** HAPP-1 what the hub knows about one game. Keep this file of the game small: the heavy code is in `routes`. */
export interface ClientGame {
  id: GameId;
  /** i18n keys. */
  nameKey: string;
  taglineKey: string;
  Icon: ComponentType<{ className?: string }>;
  playModes: Readonly<Record<PlayModeId, boolean>>;
  /** Missing pages = not built yet ("coming soon"). */
  routes: Partial<GameRoutes>;
  CosmeticPreview?: LazyExoticComponent<ComponentType<CosmeticPreviewProps>>;
  /** The game's own card on the Settings page. */
  SettingsCard?: Page;
  /** A same-device game to continue (hub home's "continue"). */
  hasSave?: () => boolean;
  devRoutes?: readonly DevRoute[];
}

/** Any mode on = the game can be played (else it is a "coming soon" card). */
export const isPlayable = (g: ClientGame): boolean => Object.values(g.playModes).some(Boolean);

/** HAPP-2 a game's page: `/g/carrom/play`, `/g/carrom/local/setup`, … */
export const gamePath = (id: string, sub = 'play'): string => `/g/${id}/${sub}`;

/** HAPP-2 the play-menu link for a mode. */
export function modePath(id: string, mode: PlayModeId): string {
  if (mode === 'local') return gamePath(id, 'local/setup');
  if (mode === 'bot') return gamePath(id, 'local/setup?vs=bot');
  return gamePath(id, mode);
}
