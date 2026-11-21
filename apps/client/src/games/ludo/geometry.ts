import { LUDO } from '@hub/ludo';

/**
 * LUDO-6 board geometry on a 15 × 15 grid (x right, y down, 1 unit = 1 cell;
 * a point is a cell centre). Seat 0's yard is top-left and play runs
 * clockwise: seat 1 top-right, seat 2 bottom-right, seat 3 bottom-left.
 * Every other seat's cells are seat 0's turned by quarter turns.
 */
export const GRID = 15;
export interface Pt { x: number; y: number }

const cell = (col: number, row: number): Pt => ({ x: col + 0.5, y: row + 0.5 });

/** One quarter turn clockwise about the board centre. */
export const turn = (p: Pt, times = 1): Pt => {
  let q = p;
  for (let i = 0; i < ((times % 4) + 4) % 4; i++) q = { x: GRID - q.y, y: q.x };
  return q;
};

/** The shared track from seat 0's start square, 52 cells (each arm: 5 out, 6 up, 2 across). */
function buildTrack(): Pt[] {
  const quarter: Pt[] = [];
  for (let c = 1; c <= 5; c++) quarter.push(cell(c, 6));
  for (let r = 5; r >= 0; r--) quarter.push(cell(6, r));
  quarter.push(cell(7, 0), cell(8, 0));
  // The next cell is the next seat's start, so each quarter is the first one turned.
  const out: Pt[] = [];
  for (let k = 0; k < 4; k++) for (const p of quarter) out.push(turn(p, k));
  return out;
}

export const TRACK: readonly Pt[] = buildTrack();

/** Home column of seat 0 (progress 51..55) and its finish point (56) inside the centre. */
const COLUMN0: readonly Pt[] = [1, 2, 3, 4, 5].map((c) => cell(c, 7));
const FINISH0: Pt = { x: 6.55, y: 7.5 };
/** Seat 0's four yard spots. */
const YARD0: readonly Pt[] = [{ x: 2, y: 2 }, { x: 4, y: 2 }, { x: 2, y: 4 }, { x: 4, y: 4 }];

export const yardSpot = (seat: number, token: number): Pt => turn(YARD0[token]!, seat);

/** Where a token at `progress` stands (yard spot for -1, centre for home). */
export function pointOf(seat: number, token: number, progress: number): Pt {
  if (progress === LUDO.YARD) return yardSpot(seat, token);
  if (progress <= LUDO.LAST_TRACK) return TRACK[(seat * LUDO.QUARTER + progress) % LUDO.TRACK]!;
  if (progress < LUDO.HOME) return turn(COLUMN0[progress - LUDO.LAST_TRACK - 1]!, seat);
  return turn(FINISH0, seat);
}

/** The cells of a seat's home column. */
export const columnOf = (seat: number): Pt[] => COLUMN0.map((p) => turn(p, seat));

/**
 * Board rotation (degrees) that puts `seat`'s yard at the bottom left, where
 * the player holding the phone sits.
 */
export const rotationFor = (seat: number): number => -90 * ((seat + 1) % 4);

/** Small offsets so tokens sharing a cell stay visible (index within the stack, stack size). */
export function stackOffset(i: number, n: number): Pt {
  if (n <= 1) return { x: 0, y: 0 };
  const d = 0.2;
  const spots: Pt[] = [{ x: -d, y: -d }, { x: d, y: d }, { x: d, y: -d }, { x: -d, y: d }];
  return spots[i % spots.length]!;
}
