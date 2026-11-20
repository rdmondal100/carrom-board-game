import { describe, expect, it } from 'vitest';
import { eloUpdate, expectedScore } from './elo.js';

describe('elo', () => {
  it('RANK-1 equal ratings: winner +16, loser −16', () => {
    expect(expectedScore(1000, 1000)).toBe(0.5);
    expect(eloUpdate(1000, 1000, 1)).toEqual([1016, 984]);
    expect(eloUpdate(1000, 1000, 0)).toEqual([984, 1016]);
    expect(eloUpdate(1500, 1500, 0.5)).toEqual([1500, 1500]);
  });

  it('RANK-1 upset: the underdog gains more than an even win', () => {
    // 1200 vs 1600: expected 1 / (1 + 10^1) = 1/11 → win gains 32 × 10/11 = 29.09.
    expect(expectedScore(1200, 1600)).toBeCloseTo(1 / 11, 12);
    expect(eloUpdate(1200, 1600, 1)).toEqual([1229, 1571]);
    // The favourite winning gains only 32 / 11 = 2.9.
    expect(eloUpdate(1600, 1200, 1)).toEqual([1603, 1197]);
    // 1000 vs 1200: E = 0.2403 → upset +24.31.
    expect(eloUpdate(1000, 1200, 1)).toEqual([1024, 1176]);
  });

  it('RANK-1 ratings are rounded to integers', () => {
    for (const [a, b] of [[1000, 1001], [1234, 987], [1999, 1001], [1000, 1050]] as const) {
      for (const s of [0, 0.5, 1] as const) {
        const [na, nb] = eloUpdate(a, b, s);
        expect(Number.isInteger(na)).toBe(true);
        expect(Number.isInteger(nb)).toBe(true);
      }
    }
    // 1000 vs 1050: E = 0.4285 → +18.29 rounds to +18, loser −18.29 → −18.
    expect(eloUpdate(1000, 1050, 1)).toEqual([1018, 1032]);
  });
});
