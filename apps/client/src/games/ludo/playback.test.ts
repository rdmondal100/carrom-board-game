import { durationOf, LUDO, type LudoEvent } from '@hub/ludo';
import { describe, expect, it } from 'vitest';
import { framesFor, framesMs } from './playback';

const Y = LUDO.YARD;
const start = [[Y, 10, Y, Y], [], [20, Y, Y, Y], []];

describe('ludo playback', () => {
  it('LUDO-6 the die rolls, the token hops one cell per frame, a capture sends the victim home', () => {
    const events: LudoEvent[] = [
      { type: 'roll', seat: 0, value: 3 },
      { type: 'move', seat: 0, token: 1, from: 10, to: 13 },
      { type: 'capture', seat: 0, victim: 2, token: 0, from: 20 },
    ];
    const frames = framesFor(start, events);
    expect(frames.map((f) => f.cue)).toEqual(['roll', 'hop', 'hop', 'hop', 'capture']);
    expect(frames.slice(1, 4).map((f) => f.tokens[0]![1])).toEqual([11, 12, 13]);
    expect(frames[3]!.tokens[2]![0]).toBe(20);
    expect(frames[4]!.tokens[2]![0]).toBe(Y);
    expect(frames.every((f) => f.dice?.value === 3)).toBe(true);
    expect(start[0]![1]).toBe(10); // the start isn't changed
  });

  it('LUDO-6 leaving the yard is one hop; reaching home marks the last hop; passes show', () => {
    const frames = framesFor([[Y, 53, Y, Y], [], [], []], [
      { type: 'roll', seat: 0, value: 6 }, { type: 'move', seat: 0, token: 0, from: Y, to: 0 },
      { type: 'roll', seat: 0, value: 3 }, { type: 'move', seat: 0, token: 1, from: 53, to: 56 }, { type: 'home', seat: 0, token: 1 },
      { type: 'roll', seat: 2, value: 2 }, { type: 'pass', seat: 2, reason: 'noMove' },
    ]);
    expect(frames.map((f) => f.cue)).toEqual(['roll', 'hop', 'roll', 'hop', 'hop', 'home', 'roll', 'pass']);
    expect(frames.at(-1)!.tokens[0]).toEqual([0, 56, Y, Y]);
  });

  it('LUDO-6 frames last exactly as long as the server waits (durationOf)', () => {
    const events: LudoEvent[] = [
      { type: 'roll', seat: 0, value: 6 }, { type: 'move', seat: 0, token: 0, from: Y, to: 0 },
      { type: 'roll', seat: 0, value: 5 }, { type: 'move', seat: 0, token: 1, from: 10, to: 15 },
      { type: 'capture', seat: 0, victim: 2, token: 0, from: 20 }, { type: 'roll', seat: 2, value: 1 }, { type: 'pass', seat: 2, reason: 'noMove' },
    ];
    expect(framesMs(framesFor(start, events))).toBe(durationOf(events));
  });
});
