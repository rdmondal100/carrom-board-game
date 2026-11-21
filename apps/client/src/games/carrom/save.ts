import { SEATINGS, type LocalGame } from './localGame';

export const SAVE_KEY = 'carrom.localGame';
const SAVE_VERSION = 1;

/** LOC-9: store the game after each shot. Storage errors are ignored. */
export function saveGame(g: LocalGame): void {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify({ v: SAVE_VERSION, game: g }));
  } catch {
    // Storage full or blocked: the game simply can't be resumed.
  }
}

export function clearSave(): void {
  try {
    localStorage.removeItem(SAVE_KEY);
  } catch {
    // Nothing to do.
  }
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

/**
 * Saves from before spec 06 have no `players` / `takeover`: everyone is a
 * person. Bad values there make the save unreadable like any other field.
 */
function withSeating(g: Record<string, unknown>): boolean {
  const names = g.names as string[];
  if (g.players === undefined) g.players = names.map(() => 'human');
  if (g.takeover === undefined) g.takeover = [];
  const players = g.players;
  return Array.isArray(players) && players.length === names.length
    && players.every((p) => (SEATINGS as readonly unknown[]).includes(p))
    && Array.isArray(g.takeover) && g.takeover.every(isNum);
}

function looksLikeGame(g: unknown): g is LocalGame {
  if (!isObj(g) || typeof g.clockOn !== 'boolean') return false;
  if (!Array.isArray(g.names) || !g.names.every((n) => typeof n === 'string')) return false;
  if (!withSeating(g)) return false;
  const s = g.state;
  if (!isObj(s) || !isObj(s.config) || !isObj(s.board) || !Array.isArray(s.board.pieces)) return false;
  if (!isObj(s.scores) || !isObj(s.pocketed) || !isObj(s.teamColour)) return false;
  if (!Array.isArray(s.pocketed.A) || !Array.isArray(s.pocketed.B)) return false;
  if (!isNum(s.turnSeat) || !isNum(s.breakSeat) || !isNum(s.boardNo)) return false;
  if (!Array.isArray(s.timeouts)) return false;
  const pieceOk = (p: unknown) => isObj(p) && typeof p.id === 'string' && typeof p.kind === 'string'
    && isNum(p.x) && isNum(p.y) && isNum(p.vx) && isNum(p.vy) && isNum(p.r) && isNum(p.m)
    && typeof p.pocketed === 'boolean';
  return s.board.pieces.every(pieceOk);
}

/** LOC-9: the saved game, or null if there is none or it is unreadable (a bad save is discarded). */
export function loadGame(): LocalGame | null {
  let raw: string | null;
  try {
    raw = localStorage.getItem(SAVE_KEY);
  } catch {
    return null;
  }
  if (raw === null) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (isObj(parsed) && parsed.v === SAVE_VERSION && looksLikeGame(parsed.game)) return parsed.game;
  } catch {
    // Fall through: corrupt JSON.
  }
  clearSave();
  return null;
}
