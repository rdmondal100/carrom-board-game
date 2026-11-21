import type { Rng } from '@hub/game-kit';

/** LUDO-2 house rules. */
export type LudoPreset = 'classic' | 'bd';

export interface LudoConfig {
  preset: LudoPreset;
  players: 2 | 3 | 4;
  /** 2v2: partners sit opposite (seats 0+2 v 1+3). Needs 4 players. */
  teams: boolean;
  /** One token home wins (team: one token of each partner). */
  quick: boolean;
  /** LUDO-3 each turn starts with a `roll` move instead of the server rolling. */
  tapToRoll: boolean;
}

/** LUDO-3 which token to move with the rolled number, or (tap to roll) the roll itself. */
export type LudoMove = { token: number } | { roll: true };

export type PassReason = 'noMove' | 'threeSixes';

export type LudoEvent =
  | { type: 'roll'; seat: number; value: number }
  | { type: 'move'; seat: number; token: number; from: number; to: number }
  | { type: 'capture'; seat: number; victim: number; token: number; from: number }
  | { type: 'home'; seat: number; token: number }
  | { type: 'pass'; seat: number; reason: PassReason }
  | { type: 'timeout'; seat: number }
  | { type: 'botTakeover'; seat: number }
  | { type: 'win'; winner: string };

export interface LudoState {
  config: LudoConfig;
  seed: number;
  rng: Rng;
  /** Progress of each token per seat 0..3 (seats not playing have none): -1 yard, 0..50 track, 51..55 column, 56 home. */
  tokens: number[][];
  turnSeat: number;
  turnId: number;
  /** 'roll': the seat on turn must roll (tap to roll, or after many passes); 'move': pick a token for `dice`. */
  phase: 'roll' | 'move';
  dice: number | null;
  /** 6s rolled in a row by the seat on turn. */
  sixes: number;
  /** Timeouts in a row per seat 0..3. */
  timeouts: number[];
  /** Seat that rolled first this game (a rematch starts with the next one). */
  first: number;
  winner: string | null;
  /** Events of the last change (rolls and passes before this turn), so a fresh screen can show them. */
  recent: LudoEvent[];
}

/** LUDO-6 what every seat sees: the whole game minus the dice source (no one can predict rolls). */
export type LudoView = Omit<LudoState, 'rng' | 'seed'>;
