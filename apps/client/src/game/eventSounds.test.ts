import { describe, expect, it } from 'vitest';
import { config, createRack, type BoardState } from '@carrom/engine';
import { soundsForEvents } from './eventSounds';

function boardWith(speeds: Record<string, [number, number]>): BoardState {
  const b = createRack(0);
  return { pieces: b.pieces.map((p) => (speeds[p.id] ? { ...p, vx: speeds[p.id]![0], vy: speeds[p.id]![1] } : p)) };
}

describe('event sounds', () => {
  it('UI-7 a hit is louder the faster the pieces meet', () => {
    const soft = soundsForEvents([{ t: 0, type: 'hit', a: 'striker', b: 'w1' }], boardWith({ striker: [0.2, 0] }));
    const hard = soundsForEvents([{ t: 0, type: 'hit', a: 'striker', b: 'w1' }], boardWith({ striker: [config.MAX_SPEED, 0] }));
    expect(soft[0]?.kind).toBe('hit');
    expect(soft[0]!.strength).toBeLessThan(hard[0]!.strength);
    expect(hard[0]!.strength).toBeCloseTo(1);
  });

  it('UI-7 one cue per kind per frame, the loudest', () => {
    const board = boardWith({ striker: [1, 0], w1: [0.1, 0] });
    const cues = soundsForEvents([
      { t: 0, type: 'hit', a: 'w1', b: 'w2' },
      { t: 1, type: 'hit', a: 'striker', b: 'w2' },
      { t: 2, type: 'frame', id: 'w1' },
      { t: 3, type: 'pocket', id: 'b1', pocket: 0 },
      { t: 4, type: 'pocket', id: 'b2', pocket: 1 },
    ], board);
    expect(cues.map((c) => c.kind).sort()).toEqual(['frame', 'hit', 'pocket']);
    const hit = cues.find((c) => c.kind === 'hit')!;
    expect(hit.strength).toBeCloseTo(Math.sqrt(1 / config.MAX_SPEED));
  });
});
