import { applyCallbreakMove, callbreakBot, callbreakView, durationOf, newCallbreak, type CallbreakEvent, type CallbreakState } from '@hub/callbreak';
import { describe, expect, it } from 'vitest';
import { framesFor } from './playback';

/** Bots play until `stop` says so; returns each step's before/after state and events. */
function steps(seed: number, count: number): { before: CallbreakState; after: CallbreakState; events: CallbreakEvent[] }[] {
  let s = newCallbreak({ rounds: 3, redeal: true }, seed);
  const out = [];
  for (let i = 0; i < count && s.winner === null; i++) {
    const r = applyCallbreakMove(s, s.turnSeat, s.turnId, callbreakBot(callbreakView(s, s.turnSeat), 'medium', i));
    if (!r.ok) throw new Error(r.message);
    out.push({ before: s, after: r.state, events: r.events });
    s = r.state;
  }
  return out;
}

describe('callbreak playback', () => {
  it('CB-7 frames take as long as the server waits; cards land in the trick, and the trick goes to its winner', () => {
    for (const { before, after, events } of steps(21, 3 * 4 * 14)) {
      const frames = framesFor(callbreakView(before, 0), events, callbreakView(after, 0));
      expect(frames.reduce((ms, f) => ms + f.ms, 0)).toBe(durationOf(events));
      const trick = events.find((e) => e.type === 'trick');
      if (trick?.type === 'trick') {
        const shown = frames.find((f) => f.cue === 'trick')!;
        expect(shown.trick).toHaveLength(4);
        expect(shown.winner).toBe(trick.winner);
      }
      const last = frames.at(-1);
      if (last && !events.some((e) => e.type === 'deal' || e.type === 'roundEnd')) expect(last.hand).toEqual(callbreakView(after, 0).hand);
    }
  });

  it('CB-7 a new deal shows the new hand and clears the calls', () => {
    const s = newCallbreak({ rounds: 3, redeal: true }, 4);
    const v = callbreakView(s, 2);
    const [deal] = framesFor(v, s.recent, v);
    expect(deal!.cue).toBe('deal');
    expect(deal!.hand).toEqual(s.hands[2]);
    expect(deal!.bids).toEqual([null, null, null, null]);
  });
});
