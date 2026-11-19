import { describe, expect, it } from 'vitest';
import { config } from './config';
import { createRack } from './rack';
import { simulateShot, stateHash } from './shot';

describe('simulateShot', () => {
  it('returns a new state and leaves the input alone', () => {
    const rack = createRack(0);
    const before = stateHash(rack);
    const out = simulateShot(rack, { seat: 0, x: 0, dirX: 0, dirY: 1, power: 1 });
    expect(stateHash(rack)).toBe(before);
    expect(stateHash(out.final)).not.toBe(before);
    expect(out.events.length).toBeGreaterThan(0);
  });

  it('rejects aims past MAX_AIM_ANGLE', () => {
    const rack = createRack(0);
    const tooWide = { seat: 0 as const, x: 0, dirX: 1, dirY: 0.05, power: 0.5 };
    expect(() => simulateShot(rack, tooWide)).toThrow(RangeError);
  });

  it('accepts a non-unit direction by normalising it', () => {
    const rack = createRack(0);
    const a = simulateShot(rack, { seat: 0, x: 0, dirX: 0, dirY: 1, power: 0.5 });
    const b = simulateShot(rack, { seat: 0, x: 0, dirX: 0, dirY: 3, power: 0.5 });
    expect(stateHash(b.final)).toBe(stateHash(a.final));
  });

  it('clamps power to MIN_POWER..1', () => {
    const rack = createRack(0);
    const low = simulateShot(rack, { seat: 0, x: 0.2, dirX: 0, dirY: 1, power: 0 });
    const min = simulateShot(rack, { seat: 0, x: 0.2, dirX: 0, dirY: 1, power: config.MIN_POWER });
    expect(stateHash(low.final)).toBe(stateHash(min.final));
  });

  it('ends with every piece at rest', () => {
    const out = simulateShot(createRack(1), { seat: 1, x: -0.1, dirX: 0.2, dirY: 1, power: 1 });
    expect(out.final.pieces.every((p) => p.vx === 0 && p.vy === 0)).toBe(true);
    expect(out.durationMs).toBeLessThanOrEqual(config.MAX_SHOT_MS);
  });
});

describe('stateHash', () => {
  it('is equal for equal states and differs on any change', () => {
    const a = createRack(0);
    const b = createRack(0);
    expect(stateHash(a)).toBe(stateHash(b));
    (b.pieces[3] as { x: number }).x += 1e-15;
    expect(stateHash(a)).not.toBe(stateHash(b));
  });
});
