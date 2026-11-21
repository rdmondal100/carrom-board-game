import { describe, expect, it } from 'vitest';
import {
  createRack, simulateShot, stateHash, type ShotEvent, type ShotInput,
} from '@carrom/engine';
import { createPlayback } from './playback';

function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const SHOTS: ShotInput[] = [
  { seat: 0, x: 0, dirX: 0, dirY: 1, power: 1 },
  { seat: 2, x: 0.07, dirX: 0.05, dirY: 0.99875, power: 1 },
  { seat: 1, x: -0.2, dirX: 0.3, dirY: 0.9, power: 0.6 },
  { seat: 3, x: 0.25, dirX: -0.6, dirY: 0.5, power: 0.35 },
];

describe('playback', () => {
  it('BRD-5 random frame times end with the same stateHash as simulateShot', () => {
    const next = rng(5);
    SHOTS.forEach((input) => {
      const rack = createRack(input.seat);
      const want = simulateShot(rack, input);
      const pb = createPlayback(rack, input);
      const events: ShotEvent[] = [];
      let out = pb.advance(0);
      for (let i = 0; i < 100_000 && !out.done; i++) {
        out = pb.advance(next() * 40);
        events.push(...out.events);
      }
      expect(out.done).toBe(true);
      expect(stateHash(out.state)).toBe(stateHash(want.final));
      expect(events).toEqual(want.events);
    });
  });

  it('BRD-5 does not change the input state', () => {
    const rack = createRack(0);
    const before = stateHash(rack);
    const pb = createPlayback(rack, SHOTS[0] as ShotInput);
    pb.advance(5000);
    expect(stateHash(rack)).toBe(before);
  });
});
