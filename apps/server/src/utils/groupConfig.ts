import type { GroupPlayers } from '@carrom/protocol';
import { gameEntry } from '../rooms/games.js';

/**
 * ADDA-3 / ADDA-4 the settings a group room of each game starts with, for the
 * seats wanted. Plain data (the game module checks it when the room is made),
 * so no game package is imported here. Callbreak always has 4 seats; the host
 * fills empty ones with bots (CB-8).
 */
const GROUP_CONFIGS: Record<string, (players: GroupPlayers) => unknown> = {
  carrom: (n) => ({ format: n === 4 ? '2v2' : '1v1', preset: 'colour', length: { kind: 'board' } }),
  ludo: (n) => ({ preset: 'bd', players: n, teams: false, quick: false, tapToRoll: false }),
  callbreak: () => ({ rounds: 5, redeal: true }),
  nodipar: (n) => ({ players: n, borsha: false }),
};

/** The checked settings of a group room of `gameId`, or null for a game the server can't run. */
export function groupConfig(gameId: string, players: GroupPlayers): unknown {
  const entry = gameEntry(gameId);
  const make = GROUP_CONFIGS[gameId];
  if (!entry || !make) return null;
  const cfg = entry.module.configSchema.safeParse(make(players));
  return cfg.success ? cfg.data : null;
}

/** Add (or replace, or with null drop) a game's group settings. Tests use it for toy games. */
export function registerGroupConfig(gameId: string, make: ((players: GroupPlayers) => unknown) | null): void {
  if (make) GROUP_CONFIGS[gameId] = make;
  else delete GROUP_CONFIGS[gameId];
}
