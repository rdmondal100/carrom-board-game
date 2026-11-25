import type { LobbyView } from '@carrom/protocol';

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

/**
 * ROOM-8 the synced room state as a lobby, or null while it is not whole yet.
 * Colyseus can report a state change before the full state has arrived (e.g.
 * right after a reconnect); screens read `players`, `phase` and `gameId`
 * directly, so a half state must never reach the store.
 */
export function lobbyFromState(raw: unknown): LobbyView | null {
  if (!isObj(raw) || !isObj(raw.players) || typeof raw.phase !== 'string' || typeof raw.code !== 'string') return null;
  if (!Object.values(raw.players).every((p) => isObj(p) && typeof p.sessionId === 'string')) return null;
  return {
    ...(raw as unknown as LobbyView),
    gameId: typeof raw.gameId === 'string' ? raw.gameId : '',
    config: typeof raw.config === 'string' ? raw.config : '{}',
  };
}
