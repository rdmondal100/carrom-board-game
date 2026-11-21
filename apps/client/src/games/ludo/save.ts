import { LudoConfigSchema } from '@hub/ludo';
import { readJson, removeStorage, writeStorage } from '@/lib/storage';
import { SEATINGS, type LocalLudo } from './localLudo';

/** Same key as index.ts reads (the hub checks for a save without loading the game). */
export const LUDO_SAVE_KEY = 'ludo.localGame';
const SAVE_VERSION = 1;

/** Store the game after each move. Storage errors are ignored. */
export function saveLudo(g: LocalLudo): void {
  writeStorage(LUDO_SAVE_KEY, JSON.stringify({ v: SAVE_VERSION, game: g }));
}

export function clearLudoSave(): void {
  removeStorage(LUDO_SAVE_KEY);
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;
const isNumArr = (v: unknown): v is number[] => Array.isArray(v) && v.every((n) => typeof n === 'number');

function looksLikeGame(g: unknown): g is LocalLudo {
  if (!isObj(g) || !isObj(g.state)) return false;
  const s = g.state;
  return LudoConfigSchema.safeParse(s.config).success
    && Array.isArray(s.tokens) && s.tokens.length === 4 && s.tokens.every(isNumArr)
    && isObj(s.rng) && typeof s.turnSeat === 'number' && typeof s.turnId === 'number'
    && Array.isArray(g.names) && g.names.every((n) => typeof n === 'string')
    && Array.isArray(g.players) && g.players.every((p) => (SEATINGS as readonly unknown[]).includes(p))
    && typeof g.clockOn === 'boolean' && isNumArr(g.takeover);
}

/** The saved game, or null (none, another version, or broken). */
export function loadLudo(): LocalLudo | null {
  const raw = readJson(LUDO_SAVE_KEY);
  if (!isObj(raw) || raw.v !== SAVE_VERSION || !looksLikeGame(raw.game)) return null;
  return raw.game;
}
