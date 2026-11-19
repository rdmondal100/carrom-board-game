import { describe, expect, it } from 'vitest';
import { firstBreakSeat, nextSeat, seatsFor, teamOf } from './turns';

describe('turns', () => {
  it('RUL-1 1 v 1 uses seats 0 and 2; 2 v 2 partners sit opposite', () => {
    expect(seatsFor('1v1')).toEqual([0, 2]);
    expect([teamOf(0, '1v1'), teamOf(2, '1v1')]).toEqual(['A', 'B']);
    expect([0, 1, 2, 3].map((s) => teamOf(s, '2v2'))).toEqual(['A', 'B', 'A', 'B']);
  });

  it('RUL-2 turn passes to the seat on the right', () => {
    expect([0, 1, 2, 3].map((s) => nextSeat(s, '2v2'))).toEqual([1, 2, 3, 0]);
    expect([nextSeat(0, '1v1'), nextSeat(2, '1v1')]).toEqual([2, 0]);
  });

  it('RUL-3 a seeded seat breaks board 1: same seed same seat, every seat possible', () => {
    expect(firstBreakSeat(42, '2v2')).toBe(firstBreakSeat(42, '2v2'));
    const seen2 = new Set(Array.from({ length: 64 }, (_, i) => firstBreakSeat(i, '2v2')));
    expect([...seen2].sort()).toEqual([0, 1, 2, 3]);
    const seen1 = new Set(Array.from({ length: 64 }, (_, i) => firstBreakSeat(i, '1v1')));
    expect([...seen1].sort()).toEqual([0, 2]);
  });
});
