import { describe, expect, test } from 'vitest';
import { mulberry32, signed } from './random';

describe('random', () => {
  test('BOT-2 same seed gives the same sequence', () => {
    const a = mulberry32(42);
    const b = mulberry32(42);
    for (let i = 0; i < 20; i++) expect(a()).toBe(b());
  });

  test('BOT-2 different seeds differ', () => {
    expect(mulberry32(1)()).not.toBe(mulberry32(2)());
  });

  test('values stay in range', () => {
    const r = mulberry32(7);
    for (let i = 0; i < 1000; i++) {
      const u = r();
      expect(u).toBeGreaterThanOrEqual(0);
      expect(u).toBeLessThan(1);
      const s = signed(r);
      expect(s).toBeGreaterThanOrEqual(-1);
      expect(s).toBeLessThan(1);
    }
  });
});
