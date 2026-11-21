import type { Card, Play } from '@hub/cards';
import { describe, expect, it } from 'vitest';
import { CB } from './config';
import { applyCallbreakMove, callbreakResult, legalCards, needsRedeal, newCallbreak, roundPoints, totalsOf } from './rules';
import { playOut } from './playOut';
import type { CallbreakState } from './types';

const trick = (...cards: Card[]): Play[] => cards.map((card, seat) => ({ seat, card }));

/** A game in the play phase with these hands, `lead` on turn. */
function inPlay(hands: Card[][], lead = 0): CallbreakState {
  const s = newCallbreak({ rounds: 5, redeal: false }, 7);
  return { ...s, hands, phase: 'play', bids: [1, 1, 1, 1], turnSeat: lead, dealer: (lead + 3) % 4 };
}

describe('callbreak rules', () => {
  it('CB-2 must follow suit, and beat the winning card if able', () => {
    expect(legalCards(['2H', 'KH', 'AS', '5D'], trick('9H'))).toEqual(['KH']);
    expect(legalCards(['2H', '5H', 'AS'], trick('9H'))).toEqual(['2H', '5H']);
    // Trumped already: any heart will do (no heart can win).
    expect(legalCards(['2H', 'KH', 'AS'], trick('9H', '3S'))).toEqual(['2H', 'KH']);
    // Leading: anything.
    expect(legalCards(['2H', 'AS'], [])).toEqual(['2H', 'AS']);
  });

  it('CB-2 must trump when void, with a spade that wins if able; else any card', () => {
    expect(legalCards(['2D', '4S', 'KS'], trick('9H'))).toEqual(['4S', 'KS']);
    expect(legalCards(['2D', '4S', 'KS'], trick('9H', 'QS'))).toEqual(['KS']);
    expect(legalCards(['2D', '4S'], trick('9H', 'QS'))).toEqual(['2D', '4S']);
    expect(legalCards(['2D', '3C'], trick('9H'))).toEqual(['2D', '3C']);
  });

  it('CB-2 an illegal card, a card not held or a call out of turn is BAD_MOVE / refused, and changes nothing', () => {
    const s = inPlay([['9H', '2S'], ['KH', 'AH'], ['3D', '4D'], ['5C', '6C']]);
    const led = applyCallbreakMove(s, 0, s.turnId, { card: '9H' });
    if (!led.ok) throw new Error(led.message);
    const bad = applyCallbreakMove(led.state, 1, led.state.turnId, { card: 'XX' as Card });
    expect(bad.ok ? null : bad.code).toBe('BAD_MOVE');
    const notHeld = applyCallbreakMove(led.state, 1, led.state.turnId, { card: '9H' });
    expect(notHeld.ok ? null : notHeld.code).toBe('BAD_MOVE');
    expect(applyCallbreakMove(led.state, 2, led.state.turnId, { card: '3D' }).ok).toBe(false);
    expect(applyCallbreakMove(led.state, 1, led.state.turnId, { bid: 3 }).ok).toBe(false);
    expect(applyCallbreakMove(led.state, 1, led.state.turnId - 1, { card: 'AH' }).ok).toBe(false);
    const ok = applyCallbreakMove(led.state, 1, led.state.turnId, { card: 'AH' });
    expect(ok.ok).toBe(true);
  });

  it('CB-2 bidding goes round from the dealer\'s left; the trick winner leads the next trick', () => {
    let s = newCallbreak({ rounds: 5, redeal: true }, 11);
    const first = (s.dealer + 1) % 4;
    expect([s.phase, s.turnSeat, s.hands.map((h) => h.length)]).toEqual(['bid', first, [13, 13, 13, 13]]);
    for (let i = 0; i < 4; i++) {
      const out = applyCallbreakMove(s, s.turnSeat, s.turnId, { bid: 2 });
      if (!out.ok) throw new Error(out.message);
      s = out.state;
    }
    expect([s.phase, s.turnSeat]).toEqual(['play', first]);
    expect(applyCallbreakMove(s, s.turnSeat, s.turnId, { bid: 9 }).ok).toBe(false);
    const p = inPlay([['9H', '2S'], ['KH', '3C'], ['AS', '4D'], ['5H', '6C']]);
    let t = p;
    for (const card of ['9H', 'KH', 'AS', '5H'] as Card[]) {
      const out = applyCallbreakMove(t, t.turnSeat, t.turnId, { card });
      if (!out.ok) throw new Error(out.message);
      t = out.state;
    }
    expect([t.turnSeat, t.won, t.trick, t.tricks.length]).toEqual([2, [0, 0, 1, 0], [], 1]);
  });

  it('CB-3 scoring examples (call 4 make 5 = 4.1; call 4 make 3 = -4)', () => {
    expect(roundPoints(4, 5) / CB.POINT).toBe(4.1);
    expect(roundPoints(4, 3) / CB.POINT).toBe(-4);
    expect(roundPoints(4, 4) / CB.POINT).toBe(4);
    expect(roundPoints(1, 13) / CB.POINT).toBe(2.2);
    expect(totalsOf([[41, -40, 30, 20], [10, 50, -30, 22]])).toEqual([51, 10, 0, 42]);
  });

  it('CB-3 a game is 5 rounds (option 3); highest total wins; placings 1-4', () => {
    for (const rounds of [5, 3] as const) {
      const s = playOut({ rounds, redeal: true }, 3, ['medium', 'medium', 'medium', 'medium']);
      expect(s.scores).toHaveLength(rounds);
      const r = callbreakResult(s)!;
      const totals = totalsOf(s.scores);
      expect(totals[Number(r.winner)]).toBe(Math.max(...totals));
      expect(r.placings[Number(r.winner)]).toBe(1);
      expect([...r.placings].sort()).toEqual(r.placings.map((_, i) => 1 + totals.filter((x) => x > totals[i]!).length).sort());
    }
  });

  it('CB-4 redeal: a hand with no spade and no face card is thrown in (option on by default)', () => {
    expect(needsRedeal(['2H', '3H', 'AD', '9C'])).toBe(true);
    expect(needsRedeal(['2H', '2S'])).toBe(false);
    expect(needsRedeal(['2H', 'JD'])).toBe(false);
    for (let seed = 0; seed < 300; seed++) {
      const s = newCallbreak({ rounds: 5, redeal: true }, seed);
      expect(s.hands.some(needsRedeal)).toBe(false);
    }
  });

  it('CB-2 the same seed and moves give the same game', () => {
    const a = playOut({ rounds: 3, redeal: true }, 99, ['hard', 'easy', 'medium', 'hard']);
    const b = playOut({ rounds: 3, redeal: true }, 99, ['hard', 'easy', 'medium', 'hard']);
    expect(a).toEqual(b);
  });
});
