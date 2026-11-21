import { describe, expect, it } from 'vitest';
import { callbreakModule, callbreakTimeout, callbreakView, CallbreakMoveSchema, DEFAULT_CALLBREAK_CONFIG } from './module';
import { CB } from './config';

describe('callbreak module', () => {
  it('CB-5 a seat sees its own hand, bids, tricks and the table; never another hand. Spectators see no hand', () => {
    const s = callbreakModule.newGame(DEFAULT_CALLBREAK_CONFIG, 5);
    expect(callbreakModule.hasHiddenInfo).toBe(true);
    for (let seat = 0; seat < 4; seat++) {
      const v = callbreakView(s, seat);
      expect(v.hand).toEqual(s.hands[seat]);
      const text = JSON.stringify(v);
      for (let other = 0; other < 4; other++) {
        if (other === seat) continue;
        for (const c of s.hands[other]!) expect(text.includes(`"${c}"`), `seat ${seat} sees ${c}`).toBe(false);
      }
      expect(Object.keys(v)).not.toContain('hands');
      expect(Object.keys(v)).not.toContain('rng');
      expect(v.handSizes).toEqual([13, 13, 13, 13]);
    }
    const spectator = callbreakView(s, null);
    expect(spectator.hand).toEqual([]);
    for (const h of s.hands) for (const c of h) expect(JSON.stringify(spectator).includes(`"${c}"`)).toBe(false);
  });

  it('CB-4 moves: a call 1-8 or a real card, nothing else', () => {
    expect(CallbreakMoveSchema.safeParse({ bid: 3 }).success).toBe(true);
    expect(CallbreakMoveSchema.safeParse({ card: 'AS' }).success).toBe(true);
    expect(CallbreakMoveSchema.safeParse({ bid: 0 }).success).toBe(false);
    expect(CallbreakMoveSchema.safeParse({ bid: 9 }).success).toBe(false);
    expect(CallbreakMoveSchema.safeParse({ card: 'ZZ' }).success).toBe(false);
    expect(CallbreakMoveSchema.safeParse({ card: 'AS', bid: 2 }).success).toBe(false);
    expect(callbreakModule.configSchema.safeParse({ rounds: 4, redeal: true }).success).toBe(false);
  });

  it('CB-4 a timeout plays for the seat; the second in a row hands it to the bot', () => {
    const s = callbreakModule.newGame(DEFAULT_CALLBREAK_CONFIG, 9);
    const seat = s.turnSeat;
    const a = callbreakTimeout(s);
    expect([a.seat, a.state.turnId, a.state.bids[seat] !== null]).toEqual([seat, 1, true]);
    expect(callbreakModule.takeovers(a.events)).toEqual([]);
    const twice = callbreakTimeout({ ...s, timeouts: s.timeouts.map((n, i) => (i === seat ? CB.TIMEOUTS_FOR_BOT - 1 : n)) });
    expect(callbreakModule.takeovers(twice.events)).toEqual([seat]);
  });

  it('CB-5 the hash covers hands (server only); a rematch deals afresh with the next dealer', () => {
    const s = callbreakModule.newGame(DEFAULT_CALLBREAK_CONFIG, 5);
    const swapped = { ...s, hands: [s.hands[1]!, s.hands[0]!, s.hands[2]!, s.hands[3]!] };
    expect(callbreakModule.hash(swapped)).not.toBe(callbreakModule.hash(s));
    const r = callbreakModule.rematch(s);
    expect(r.dealer).toBe((s.dealer + 1) % 4);
    expect(r.hands).not.toEqual(s.hands);
  });
});
