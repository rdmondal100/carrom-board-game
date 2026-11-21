import { CallbreakConfigSchema } from '@hub/callbreak';
import { readJson, removeStorage, writeStorage } from '@/lib/storage';
import { BOT_LEVELS, type LocalCallbreak } from './localCallbreak';

/** Same key as index.ts reads (the hub checks for a save without loading the game). */
export const CB_SAVE_KEY = 'callbreak.localGame';
const SAVE_VERSION = 1;
const SEATS = 4;

export function saveCallbreak(g: LocalCallbreak): void {
  writeStorage(CB_SAVE_KEY, JSON.stringify({ v: SAVE_VERSION, game: g }));
}

export function clearCallbreakSave(): void {
  removeStorage(CB_SAVE_KEY);
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;
const isArr = (v: unknown, n: number): v is unknown[] => Array.isArray(v) && v.length === n;

function looksLikeGame(g: unknown): g is LocalCallbreak {
  if (!isObj(g) || !isObj(g.state)) return false;
  const s = g.state;
  return CallbreakConfigSchema.safeParse(s.config).success
    && isArr(s.hands, SEATS) && s.hands.every((h) => Array.isArray(h)) && isArr(s.bids, SEATS) && isArr(s.won, SEATS)
    && Array.isArray(s.trick) && Array.isArray(s.tricks) && Array.isArray(s.scores)
    && isObj(s.rng) && typeof s.turnSeat === 'number' && typeof s.turnId === 'number'
    && isArr(g.names, SEATS) && g.names.every((n) => typeof n === 'string')
    && isArr(g.levels, SEATS) && g.levels.every((l) => (BOT_LEVELS as readonly unknown[]).includes(l))
    && typeof g.clockOn === 'boolean' && typeof g.takeover === 'boolean';
}

/** The saved game, or null (none, another version, or broken). */
export function loadCallbreak(): LocalCallbreak | null {
  const raw = readJson(CB_SAVE_KEY);
  if (!isObj(raw) || raw.v !== SAVE_VERSION || !looksLikeGame(raw.game)) return null;
  return raw.game;
}
