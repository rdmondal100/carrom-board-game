// NODI-2 every Nodi Par rule number lives here. Table physics (rocks,
// whirlpools, boat size) are in the engine's config (`TABLES`, `NODI`).
import type { TableId, Vec } from '@carrom/engine';

export interface Island extends Vec {
  /** A boat whose centre is closer than r to (x, y) is moored here. */
  r: number;
  points: number;
}

export interface Layout {
  table: Exclude<TableId, 'carrom'>;
  islands: readonly Island[];
  /** The fixed island graph: pairs of neighbouring islands. */
  links: readonly (readonly [number, number])[];
  /** Islands touching each bank, by seat 0..3. */
  banks: readonly (readonly number[])[];
  /** Launch spots run ±bankHalf along the bank. */
  bankHalf: number;
}

const SMALL = 0.07;
const BIG = 0.11;

export const NODI_RULES = {
  BOATS: 6,
  LAUNCHES: 6,
  /** Moves per player per round = LAUNCHES + EXTRA_FLICKS. A sunk boat comes back to hand and may be launched again. */
  EXTRA_FLICKS: 3,
  ISLAND_POINTS: 1,
  CENTRE_POINTS: 3,
  PAR_BONUS: 5,
  /** Best of 3: two round wins take the match. */
  ROUNDS_TO_WIN: 2,
  ROUNDS: 3,
  /** Still level after ROUNDS (drawn rounds): play on up to this many. */
  MAX_ROUNDS: 5,
  /** Same shot clock as carrom; RUL-10 takeover after two timeouts in a row. */
  CLOCK_MS: 20_000,
  TIMEOUTS_FOR_BOT: 2,
  MIN_POWER: 0.1,
  MAX_POWER: 1,
} as const;

/** 1v1: banks at +y (seat 0) and -y (seat 2). Symmetric under y → -y. */
const RIVER: Layout = {
  table: 'nodiPar',
  islands: [
    { x: -0.18, y: 0.22, r: SMALL, points: NODI_RULES.ISLAND_POINTS },
    { x: 0.18, y: 0.22, r: SMALL, points: NODI_RULES.ISLAND_POINTS },
    { x: -0.28, y: 0, r: SMALL, points: NODI_RULES.ISLAND_POINTS },
    { x: 0, y: 0, r: BIG, points: NODI_RULES.CENTRE_POINTS },
    { x: 0.28, y: 0, r: SMALL, points: NODI_RULES.ISLAND_POINTS },
    { x: -0.18, y: -0.22, r: SMALL, points: NODI_RULES.ISLAND_POINTS },
    { x: 0.18, y: -0.22, r: SMALL, points: NODI_RULES.ISLAND_POINTS },
  ],
  links: [[0, 1], [1, 4], [4, 6], [6, 5], [5, 2], [2, 0], [3, 0], [3, 1], [3, 2], [3, 4], [3, 5], [3, 6]],
  banks: [[0, 1], [2], [5, 6], [4]],
  bankHalf: 0.4,
};

/** 2v2 cross: banks on all four sides, partners opposite. Symmetric under x ↔ y. */
const CROSS: Layout = {
  table: 'nodiPar4',
  islands: [
    { x: 0, y: 0.25, r: SMALL, points: NODI_RULES.ISLAND_POINTS },
    { x: 0.25, y: 0, r: SMALL, points: NODI_RULES.ISLAND_POINTS },
    { x: 0, y: -0.25, r: SMALL, points: NODI_RULES.ISLAND_POINTS },
    { x: -0.25, y: 0, r: SMALL, points: NODI_RULES.ISLAND_POINTS },
    { x: 0, y: 0, r: BIG, points: NODI_RULES.CENTRE_POINTS },
    { x: -0.2, y: 0.2, r: SMALL, points: NODI_RULES.ISLAND_POINTS },
    { x: 0.2, y: -0.2, r: SMALL, points: NODI_RULES.ISLAND_POINTS },
  ],
  links: [[4, 0], [4, 1], [4, 2], [4, 3], [4, 5], [4, 6], [0, 5], [5, 3], [1, 6], [6, 2]],
  banks: [[0, 5], [3, 5], [2, 6], [1, 6]],
  bankHalf: 0.24,
};

export const LAYOUTS: Record<2 | 4, Layout> = { 2: RIVER, 4: CROSS };

/** How long the client shows a round's score before the next round, ms (added to the move's replay). */
export const NODI_ANIM = { ROUND_END_MS: 2500 } as const;

/** NODI-3 bot levels. Powers are found from the stopping distance, then scaled by `powerScales`. */
export const NODI_BOT = {
  LEVELS: {
    easy: { sims: 10, aimNoiseSin: 0.06975647374, powerNoise: 0.15, powerScales: [1] },
    medium: { sims: 36, aimNoiseSin: 0.02617694831, powerNoise: 0.06, powerScales: [0.96, 1.04] },
    hard: { sims: 80, aimNoiseSin: 0.00523596383, powerNoise: 0.02, powerScales: [0.94, 1, 1.06] },
  },
  /** Launch spots tried along the bank. */
  BANK_SPOTS: 5,
  /** Points scored, per point of difference with the other side. */
  POINT: 100,
  /** Per own moored boat, scaled by how deep it sits in its ring. */
  DEEP: 12,
  /** Per opponent boat sent into a whirlpool / per own boat lost there. */
  SUNK: 15,
  LOST: -20,
  /** A blocked path keeps its aim but ranks this many times lower. */
  BLOCKED_PENALTY: 4,
  /** Hits on opponent boats push them on by this much past contact, L. */
  PUSH_PAST: 0.25,
} as const;
