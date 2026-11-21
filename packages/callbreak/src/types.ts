import type { Card, Play } from '@hub/cards';
import type { Rng } from '@hub/game-kit';

/** CB-3 / CB-4 room settings. */
export interface CallbreakConfig {
  rounds: 3 | 5;
  /** Redeal when a hand has no spade and no face card. */
  redeal: boolean;
}

/** CB-4 a call in the bidding phase, a card in play. */
export type CallbreakMove = { bid: number } | { card: Card };

export type CallbreakEvent =
  | { type: 'deal'; round: number; dealer: number; redeals: number }
  | { type: 'bid'; seat: number; bid: number }
  | { type: 'play'; seat: number; card: Card }
  | { type: 'trick'; winner: number }
  /** CB-3 this round's points per seat, in tenths. */
  | { type: 'roundEnd'; round: number; points: number[] }
  | { type: 'timeout'; seat: number }
  | { type: 'botTakeover'; seat: number }
  | { type: 'win'; winner: string };

export type CallbreakPhase = 'bid' | 'play' | 'over';

export interface CallbreakState {
  config: CallbreakConfig;
  seed: number;
  rng: Rng;
  /** 1-based round being played (the last one once the game is over). */
  round: number;
  dealer: number;
  phase: CallbreakPhase;
  /** CB-5 secret: each seat's cards. Never sent except a seat's own hand. */
  hands: Card[][];
  /** Calls this round per seat (null = not called yet). */
  bids: (number | null)[];
  /** Tricks won this round per seat. */
  won: number[];
  /** The trick on the table. */
  trick: Play[];
  /** Finished tricks this round, in order (public: everyone saw them played). */
  tricks: Play[][];
  /** CB-3 points per finished round per seat, in tenths. */
  scores: number[][];
  turnSeat: number;
  turnId: number;
  timeouts: number[];
  winner: string | null;
  /** Events of the last change, so a fresh screen can show them. */
  recent: CallbreakEvent[];
}

/** CB-5 what one seat sees: everything public plus its own hand (spectators: no hand). */
export type CallbreakView = Omit<CallbreakState, 'rng' | 'seed' | 'hands'> & {
  /** Whose view this is (null = a spectator). */
  seat: number | null;
  hand: Card[];
  /** Cards left in each hand. */
  handSizes: number[];
};
