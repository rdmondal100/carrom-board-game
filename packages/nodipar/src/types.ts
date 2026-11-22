import type { BoardState, ShotEvent } from '@carrom/engine';

export interface NodiConfig {
  /** 2 = 1v1 on the river, 4 = 2v2 on the cross (partners opposite: seats 0+2 v 1+3). */
  players: 2 | 4;
  /** Borsha (monsoon): a steady current pushes moving boats downstream. */
  borsha: boolean;
}

/** One flick. Directions are seat-relative like carrom: dirY > 0 is away from your bank. */
export type NodiMove =
  | { kind: 'launch'; x: number; dirX: number; dirY: number; power: number }
  | { kind: 'flick'; boat: number; dirX: number; dirY: number; power: number };

export type Team = 'A' | 'B';

export interface RoundResult {
  round: number;
  points: Record<Team, number>;
  /** null = a drawn round. */
  winner: Team | null;
}

export type NodiEvent =
  | { type: 'launch'; seat: number; boat: number; x: number; y: number }
  | { type: 'flick'; seat: number; boat: number }
  /** The physics of the move (hits, rocks, whirlpools) for sounds. */
  | { type: 'shot'; events: ShotEvent[] }
  | { type: 'whirlpool'; seat: number; boat: number }
  | { type: 'island'; island: number; owner: Team | null }
  | { type: 'par'; team: Team; islands: number[] }
  | { type: 'roundEnd'; result: RoundResult }
  | { type: 'timeout'; seat: number }
  | { type: 'botTakeover'; seat: number }
  | { type: 'win'; winner: Team };

export interface NodiState {
  config: NodiConfig;
  seed: number;
  /** Boats are pieces `${seat}-${k}`; a pocketed boat is in its owner's hand on the bank. */
  board: BoardState;
  turnSeat: number;
  turnId: number;
  /** 1-based. */
  round: number;
  /** Seat that moved first this round / in round 1 (a rematch starts with the next). */
  roundFirst: number;
  first: number;
  /** Moves made this round, per seat 0..3. */
  moves: number[];
  /** Timeouts in a row per seat 0..3. */
  timeouts: number[];
  /** Owner of each island now (null = nobody / tie). */
  owners: (Team | null)[];
  /** Islands of each side's current par chain ([] = no par). */
  pars: Record<Team, number[]>;
  /** Points each side would score if the round ended now. */
  live: Record<Team, number>;
  results: RoundResult[];
  winner: Team | null;
}

/** No hidden information and no dice: every seat sees the whole game. */
export type NodiView = NodiState;
