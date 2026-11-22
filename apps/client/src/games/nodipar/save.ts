import { NodiConfigSchema } from '@hub/nodipar';
import { readJson, removeStorage, writeStorage } from '@/lib/storage';
import { SEATINGS, type LocalNodi } from './localNodi';

/** Same key as index.ts reads (the hub checks for a save without loading the game). */
export const NODI_SAVE_KEY = 'nodipar.localGame';
const SAVE_VERSION = 1;

export function saveNodi(g: LocalNodi): void {
  writeStorage(NODI_SAVE_KEY, JSON.stringify({ v: SAVE_VERSION, game: g }));
}

export function clearNodiSave(): void {
  removeStorage(NODI_SAVE_KEY);
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;
const isNumArr = (v: unknown): v is number[] => Array.isArray(v) && v.every((n) => typeof n === 'number');

function looksLikeGame(g: unknown): g is LocalNodi {
  if (!isObj(g) || !isObj(g.state)) return false;
  const s = g.state;
  return NodiConfigSchema.safeParse(s.config).success
    && isObj(s.board) && Array.isArray(s.board.pieces) && typeof s.turnSeat === 'number' && typeof s.turnId === 'number'
    && isNumArr(s.moves) && isNumArr(s.timeouts) && Array.isArray(s.owners) && isObj(s.pars) && isObj(s.live) && Array.isArray(s.results)
    && Array.isArray(g.names) && g.names.every((n) => typeof n === 'string')
    && Array.isArray(g.players) && g.players.every((p) => (SEATINGS as readonly unknown[]).includes(p))
    && typeof g.clockOn === 'boolean' && isNumArr(g.takeover);
}

/** The saved game, or null (none, another version, or broken). */
export function loadNodi(): LocalNodi | null {
  const raw = readJson(NODI_SAVE_KEY);
  if (!isObj(raw) || raw.v !== SAVE_VERSION || !looksLikeGame(raw.game)) return null;
  return raw.game;
}
