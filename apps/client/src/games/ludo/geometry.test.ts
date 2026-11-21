import { LUDO, SAFE_SQUARES } from '@hub/ludo';
import { describe, expect, it } from 'vitest';
import { columnOf, GRID, pointOf, rotationFor, TRACK, turn } from './geometry';

const key = (p: { x: number; y: number }) => `${p.x},${p.y}`;
/** Next to each other, sideways or (at an arm's corner, as on a real board) diagonally. */
const adjacent = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y)) === 1;

describe('ludo board geometry', () => {
  it('LUDO-6 the track is 52 distinct cells, each next to the one before, closing the loop', () => {
    expect(TRACK).toHaveLength(LUDO.TRACK);
    expect(new Set(TRACK.map(key)).size).toBe(LUDO.TRACK);
    TRACK.forEach((p, i) => expect(adjacent(p, TRACK[(i + 1) % TRACK.length]!), `cell ${i}`).toBe(true));
    for (const p of TRACK) expect(p.x > 0 && p.x < GRID && p.y > 0 && p.y < GRID).toBe(true);
  });

  it('LUDO-6 each seat\'s column leaves its last track cell, never crosses the track and ends at the centre', () => {
    const track = new Set(TRACK.map(key));
    for (let seat = 0; seat < 4; seat++) {
      const last = pointOf(seat, 0, LUDO.LAST_TRACK);
      const col = columnOf(seat);
      expect(adjacent(last, col[0]!)).toBe(true);
      for (const p of col) expect(track.has(key(p))).toBe(false);
      const home = pointOf(seat, 0, LUDO.HOME);
      expect(Math.abs(home.x - GRID / 2) < 1.5 && Math.abs(home.y - GRID / 2) < 1.5).toBe(true);
    }
  });

  it('LUDO-6 seats are quarter turns of each other; every seat starts on a safe square', () => {
    for (let seat = 0; seat < 4; seat++) {
      expect(pointOf(seat, 0, 0)).toEqual(turn(pointOf(0, 0, 0), seat));
      expect(SAFE_SQUARES).toContain(seat * LUDO.QUARTER);
    }
    // Yard spots are in the seat's own corner.
    expect(pointOf(0, 0, LUDO.YARD).x < 6 && pointOf(0, 0, LUDO.YARD).y < 6).toBe(true);
    expect(pointOf(2, 3, LUDO.YARD).x > 9 && pointOf(2, 3, LUDO.YARD).y > 9).toBe(true);
  });

  it('LUDO-6 the view rotation puts the viewer\'s yard bottom left', () => {
    for (let seat = 0; seat < 4; seat++) {
      const quarterTurns = ((rotationFor(seat) / 90) % 4 + 4) % 4;
      const yard = turn(pointOf(seat, 0, LUDO.YARD), quarterTurns);
      expect(yard.x < 6 && yard.y > 9, `seat ${seat}`).toBe(true);
    }
  });
});
