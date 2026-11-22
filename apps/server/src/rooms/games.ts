import { carromModule } from '@carrom/game';
import { callbreakModule } from '@hub/callbreak';
import { ludoModule } from '@hub/ludo';
import { nodiParModule } from '@hub/nodipar';
import type { AnyGameModule } from '@hub/game-kit';
import { RANKED_CONFIGS } from '../utils/rankedConfig.js';

/** HUB-4 one game the server can run: its module and, when it has ranked play, the ranked settings. */
export interface GameEntry {
  module: AnyGameModule;
  /** HUB-6 the config every ranked game of this kind uses; null = no ranked queue. */
  rankedConfig: unknown;
}

const games = new Map<string, GameEntry>();

/** Add (or replace) a game. The server registers its games at load; tests add toy games. */
export function registerGame(module: AnyGameModule, rankedConfig: unknown = null): void {
  games.set(module.id, { module, rankedConfig });
}

/** For tests: drop a game again. */
export function unregisterGame(id: string): void {
  games.delete(id);
}

registerGame(carromModule, RANKED_CONFIGS.carrom);
registerGame(ludoModule, RANKED_CONFIGS.ludo);
// CB-8 no ranked Callbreak yet (a 4-player rating comes later).
registerGame(callbreakModule);
// NODI-5 ranked Nodi Par comes after playtesting.
registerGame(nodiParModule);

/** HUB-4 the registered game with this id, or null. */
export function gameEntry(id: unknown): GameEntry | null {
  return typeof id === 'string' ? games.get(id) ?? null : null;
}

/** The module of a registered game; throws for an unknown id (callers check first). */
export function gameModule(id: string): AnyGameModule {
  const e = games.get(id);
  if (!e) throw new Error(`Unknown game ${id}`);
  return e.module;
}

/** HUB-6 games with a ranked queue. */
export function isRankedGame(id: unknown): id is string {
  return gameEntry(id)?.rankedConfig != null;
}

export const isKnownGame = (id: unknown): id is string => gameEntry(id) !== null;
