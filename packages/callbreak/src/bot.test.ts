import type { Card } from '@hub/cards';
import { describe, expect, it } from 'vitest';
import { bidFor, callbreakBot, estimateTricks } from './bot';
import { callbreakView } from './module';
import { playOut } from './playOut';
import { newCallbreak, totalsOf } from './rules';
import type { CallbreakState } from './types';

const GAMES = 100;

describe('callbreak bots', () => {
  it('CB-6 bidding counts sure tricks: high spades, aces, voids', () => {
    const strong: Card[] = ['AS', 'KS', 'QS', 'JS', '9S', '5S', 'AH', 'KH', 'AD', '3D', '2D', 'AC', '4C'];
    const weak: Card[] = ['2S', '3H', '4H', '5H', '7H', '9H', '2D', '4D', '6D', '8D', '3C', '5C', '7C'];
    expect(estimateTricks(strong)).toBeGreaterThan(7);
    expect(bidFor(strong, 'medium', 1)).toBe(8);
    expect(bidFor(weak, 'medium', 1)).toBe(1);
    const voidHand: Card[] = ['AS', '4S', '5S', '6S', '2H', '3H', '4H', '5H', '6H', '7H', '8H', '9H', 'TH'];
    expect(estimateTricks(voidHand)).toBeGreaterThan(estimateTricks(['AS', '4S', '5S', '6S', '2H', '3H', '4H', '2D', '3D', '4D', '2C', '3C', '4C']));
  });

  it('CB-6 bots only ever pick legal moves and read only their own view', () => {
    for (const level of ['easy', 'medium', 'hard'] as const) playOut({ rounds: 3, redeal: true }, 17, [level, level, level, level]);
    // Same view, other hands changed: same move.
    const s = newCallbreak({ rounds: 5, redeal: true }, 4);
    const other: CallbreakState = { ...s, hands: [s.hands[0]!, s.hands[2]!, s.hands[3]!, s.hands[1]!] };
    const seat = 0;
    expect(callbreakBot(callbreakView(s, seat), 'hard', 1)).toEqual(callbreakBot(callbreakView(other, seat), 'hard', 1));
  });

  it('CB-6 rules of thumb: win cheaply when the call needs it, duck once it is made', () => {
    const base = newCallbreak({ rounds: 5, redeal: false }, 2);
    const view = (won: number) => callbreakView({
      ...base, phase: 'play', turnSeat: 3, bids: [2, 2, 2, 2], won: [0, 0, 0, won],
      hands: [[], [], [], ['AH', 'KH', '3H']], trick: [{ seat: 0, card: '9H' }, { seat: 1, card: 'TH' }, { seat: 2, card: '2H' }],
    }, 3);
    expect(callbreakBot(view(0), 'medium', 1)).toEqual({ card: 'KH' });
    expect(callbreakBot(view(2), 'medium', 1)).toEqual({ card: 'KH' });
    const duck = callbreakView({
      ...base, phase: 'play', turnSeat: 3, bids: [2, 2, 2, 2], won: [0, 0, 0, 2],
      hands: [[], [], [], ['AH', '8H', '3H']], trick: [{ seat: 0, card: '9H' }, { seat: 1, card: 'TH' }, { seat: 2, card: '2H' }],
    }, 3);
    expect(callbreakBot(duck, 'medium', 1)).toEqual({ card: 'AH' }); // must beat if able: AH is the only legal card
    const free = callbreakView({
      ...base, phase: 'play', turnSeat: 3, bids: [2, 2, 2, 2], won: [0, 0, 0, 2],
      hands: [[], [], [], ['AD', '8D', '3C']], trick: [{ seat: 0, card: '9H' }, { seat: 1, card: 'TH' }, { seat: 2, card: '2H' }],
    }, 3);
    expect(callbreakBot(free, 'medium', 1)).toEqual({ card: 'AD' }); // void, no spade: shed the highest loser
  });

  it(`CB-6 hard bots beat easy bots on average over ${GAMES} seeded games`, () => {
    let hard = 0;
    let easy = 0;
    for (let g = 0; g < GAMES; g++) {
      const levels = g % 2 === 0 ? (['hard', 'easy', 'hard', 'easy'] as const) : (['easy', 'hard', 'easy', 'hard'] as const);
      const totals = totalsOf(playOut({ rounds: 3, redeal: true }, 1000 + g, levels).scores);
      totals.forEach((t, seat) => { if (levels[seat] === 'hard') hard += t; else easy += t; });
    }
    console.info(`CB-6 mean per seat per game (points): hard ${(hard / GAMES / 20).toFixed(2)}, easy ${(easy / GAMES / 20).toFixed(2)}`);
    expect(hard).toBeGreaterThan(easy);
  });
});
