import { seatsFor, teamOf, type GameState, type Team } from '@carrom/rules';
import { seatName, type LocalGame } from './localGame';

/** An i18n key plus its placeholder values. The view calls t(key, vars). */
export interface Msg { key: string; vars?: Record<string, string | number> }

/** Rules' `returned` reasons → i18n keys. Anything else falls back to reason.unknown. */
export const REASON_KEYS: Record<string, string> = {
  'last coin while red is on the board': 'reason.lastCoin',
  'red not covered': 'reason.redNotCovered',
  'red before a coin': 'reason.redBeforeCoin',
};
export const UNKNOWN_REASON_KEY = 'reason.unknown';

export function reasonKey(reason: string): string {
  return REASON_KEYS[reason] ?? UNKNOWN_REASON_KEY;
}

/** 1 v 1: the player's name. 2 v 2: both partners, "A & C". */
export function teamLabel(g: LocalGame, team: Team): string {
  const { format } = g.state.config;
  return seatsFor(format)
    .filter((s) => teamOf(s, format) === team)
    .map((s) => seatName(g, s))
    .join(' & ');
}

/** Coins (not red) a side has down this board. */
export function coinsDown(state: GameState, team: Team): number {
  return state.pocketed[team].filter((id) => id !== 'red').length;
}

/** LOC-4: red on the board, waiting for cover by a player, or covered by a side. */
export function redStatus(g: LocalGame): Msg {
  const { state } = g;
  for (const team of ['A', 'B'] as const) {
    if (state.pocketed[team].includes('red')) {
      return { key: 'hud.redCovered', vars: { name: teamLabel(g, team) } };
    }
  }
  if (state.redPending) {
    return { key: 'hud.redWaiting', vars: { name: seatName(g, state.redPending.seat) } };
  }
  return { key: 'hud.redOnBoard' };
}

/** LOC-4: "Team A 12 – 7 Team B" with names. */
export function scoreLine(g: LocalGame): string {
  const { scores } = g.state;
  return `${teamLabel(g, 'A')} ${scores.A} – ${scores.B} ${teamLabel(g, 'B')}`;
}

/** Colour a side plays this board, or null in the point game. */
export function sideColour(state: GameState, team: Team): 'white' | 'black' | null {
  return state.teamColour[team];
}

/** i18n key for a coin id: w1..w9, b1..b9, red. */
export function coinKey(id: string): string {
  if (id === 'red') return 'coin.red';
  return id.startsWith('b') ? 'coin.black' : 'coin.white';
}
