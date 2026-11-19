import { describe, expect, it } from 'vitest';
import { defaultSetup, localSetupSchema, toGame, type LocalSetup } from './localSetup';

const ok = (v: LocalSetup) => localSetupSchema.safeParse(v).success;

describe('localSetup schema', () => {
  it('LOC-1 accepts the defaults and every valid preset/length pair', () => {
    expect(ok(defaultSetup())).toBe(true);
    for (const length of ['board', '19', '29'] as const) expect(ok({ ...defaultSetup(), preset: 'colour', length })).toBe(true);
    for (const length of ['board', '300'] as const) expect(ok({ ...defaultSetup(), preset: 'point', length })).toBe(true);
    expect(ok({ ...defaultSetup(), format: '2v2', clockOn: false })).toBe(true);
  });

  it('LOC-1 rejects length/preset mismatches', () => {
    expect(ok({ ...defaultSetup(), preset: 'colour', length: '300' })).toBe(false);
    expect(ok({ ...defaultSetup(), preset: 'point', length: '19' })).toBe(false);
    expect(ok({ ...defaultSetup(), preset: 'point', length: '29' })).toBe(false);
  });

  it('LOC-1 rejects bad names for seated players only', () => {
    const names = (n: string[]) => ({ ...defaultSetup(), names: n });
    expect(ok(names(['', 'B', 'C', 'D']))).toBe(false);
    expect(ok(names(['   ', 'B', 'C', 'D']))).toBe(false);
    expect(ok(names(['A', 'x'.repeat(17), 'C', 'D']))).toBe(false);
    expect(ok(names(['A', 'x'.repeat(16), 'C', 'D']))).toBe(true);
    // 1 v 1 ignores players 3 and 4; 2 v 2 checks them.
    expect(ok(names(['A', 'B', '', '']))).toBe(true);
    expect(ok({ ...names(['A', 'B', '', 'D']), format: '2v2' })).toBe(false);
    expect(ok({ ...defaultSetup(), names: ['A', 'B'] })).toBe(false);
  });

  it('LOC-1 toGame builds the config and trims seated names', () => {
    const v: LocalSetup = { format: '1v1', preset: 'colour', length: '29', names: [' Asha ', 'Bilu', 'x', 'y'], clockOn: true };
    expect(toGame(v, 5)).toEqual({
      cfg: { format: '1v1', preset: 'colour', length: { kind: 'points', target: 29 }, seed: 5 },
      names: ['Asha', 'Bilu'],
    });
    expect(toGame({ ...v, preset: 'point', length: 'board' }, 1).cfg.length).toEqual({ kind: 'board' });
  });
});
