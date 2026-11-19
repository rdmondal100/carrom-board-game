import type { Seat } from '@carrom/engine';
import type { Format, Team } from './types';

/** RUL-1: 1 v 1 uses seats 0 and 2; 2 v 2 uses all four. */
export function seatsFor(format: Format): Seat[] {
  return format === '1v1' ? [0, 2] : [0, 1, 2, 3];
}

/** RUL-1: partners sit opposite. Team A = seats 0 (+2 in 2 v 2), B = the rest. */
export function teamOf(seat: number, format: Format): Team {
  if (format === '1v1') return seat === 0 ? 'A' : 'B';
  return seat % 2 === 0 ? 'A' : 'B';
}

export function otherTeam(team: Team): Team {
  return team === 'A' ? 'B' : 'A';
}

/** RUL-2: the turn passes to the seat on the right. */
export function nextSeat(seat: number, format: Format): number {
  return format === '1v1' ? (seat === 0 ? 2 : 0) : (seat + 1) % 4;
}

/** RUL-3: a seeded pick of who breaks board 1 (mulberry32, one draw). */
export function firstBreakSeat(seed: number, format: Format): Seat {
  let t = (seed + 0x6d2b79f5) >>> 0;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  const u = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  const seats = seatsFor(format);
  return seats[Math.floor(u * seats.length)] as Seat;
}

/** RUL-3: after board 1 the break alternates sides, moving one seat right. */
export function nextBreakSeat(breakSeat: number, format: Format): Seat {
  return nextSeat(breakSeat, format) as Seat;
}
