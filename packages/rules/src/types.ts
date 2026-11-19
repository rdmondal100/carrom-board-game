import type { BoardState } from '@carrom/engine';

export type Preset = 'colour' | 'point';
export type Format = '1v1' | '2v2';
export type Team = 'A' | 'B';
export type Colour = 'white' | 'black';

export type Length = { kind: 'board' } | { kind: 'points'; target: 19 | 29 | 300 };

export interface GameConfig {
  format: Format;
  preset: Preset;
  length: Length;
  /** Picks who breaks board 1. Same seed, same game. */
  seed: number;
}

export interface GameState {
  config: GameConfig;
  board: BoardState;
  turnSeat: number;
  /** Seat that broke the current board. */
  breakSeat: number;
  /** Colour game only; null in the point game. */
  teamColour: Record<Team, Colour | null>;
  /** Coin ids each side has down this board ('red' once covered). */
  pocketed: Record<Team, string[]>;
  /** Red pocketed by `seat`, waiting for cover on that seat's next shot. */
  redPending: null | { seat: number; shotsLeft: 1 | 2 };
  /** 1-based. */
  boardNo: number;
  scores: Record<Team, number>;
  winner: Team | null;
  /** Timeouts in a row, per seat 0..3. */
  timeouts: number[];
}

export type RuleEvent =
  | { type: 'turn'; seat: number }
  | { type: 'returned'; id: string; reason: string }
  | { type: 'redCovered'; team: Team }
  | { type: 'boardEnd'; winner: Team; points: number }
  | { type: 'gameEnd'; winner: Team }
  | { type: 'botTakeover'; seat: number };

/** What a preset decides about one shot, before the game moves on. */
export interface ShotOutcome {
  pocketed: Record<Team, string[]>;
  /** Coin ids to put back on the board, in order. */
  returns: { id: string; reason: string }[];
  redPending: GameState['redPending'];
  redCoveredBy: Team | null;
  keepTurn: boolean;
  /** Set when this shot ends the board. */
  boardWinner: Team | null;
}
