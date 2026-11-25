import { describe, expect, it } from 'vitest';
import { diceSpot } from './diceSpot';

describe('diceSpot', () => {
  it('MOT-1 each relative seat maps to its corner and facing', () => {
    expect(diceSpot(2, 2)).toEqual({ corner: 'bl', facing: 0 });
    expect(diceSpot(3, 2)).toEqual({ corner: 'tl', facing: 90 });
    expect(diceSpot(0, 2)).toEqual({ corner: 'tr', facing: 180 });
    expect(diceSpot(1, 2)).toEqual({ corner: 'br', facing: 270 });
  });

  it('MOT-1 seat 0 viewing: seats run clockwise from bottom left', () => {
    expect([0, 1, 2, 3].map((s) => diceSpot(s, 0).corner)).toEqual(['bl', 'tl', 'tr', 'br']);
  });
});
