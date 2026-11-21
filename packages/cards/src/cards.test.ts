import { describe, expect, it } from 'vitest';
import { beats, deal, DECK, isCard, rankOf, sortHand, suitOf, winningPlay, type Card } from './cards';

describe('cards', () => {
  it('CB-1 seeded deal: same seed same hands; 52 unique cards', () => {
    const [a] = deal({ seed: 42 }, 4, 13);
    const [b] = deal({ seed: 42 }, 4, 13);
    const [c] = deal({ seed: 43 }, 4, 13);
    expect(a).toEqual(b);
    expect(a).not.toEqual(c);
    expect(a.map((h) => h.length)).toEqual([13, 13, 13, 13]);
    const all = a.flat();
    expect(new Set(all).size).toBe(52);
    expect([...all].sort()).toEqual([...DECK].sort());
  });

  it('CB-1 suit and rank helpers; hands sort by suit then high to low', () => {
    expect(DECK).toHaveLength(52);
    expect([suitOf('AS'), rankOf('AS'), rankOf('2C'), rankOf('TH')]).toEqual(['S', 14, 2, 10]);
    expect(isCard('KD')).toBe(true);
    expect(isCard('1S')).toBe(false);
    expect(sortHand(['2D', 'AS', 'KH', '3S', 'QC'])).toEqual(['AS', '3S', 'KH', 'QC', '2D']);
  });

  it('CB-1 trick winner: highest of the led suit, unless a trump is played', () => {
    const trick = (cards: Card[]) => cards.map((card, seat) => ({ seat, card }));
    expect(winningPlay(trick(['9H', 'KH', 'AD', '2H']), 'S')?.seat).toBe(1);
    expect(winningPlay(trick(['9H', 'KH', '2S', 'AH']), 'S')?.seat).toBe(2);
    expect(winningPlay(trick(['9H', '3S', '2S', 'AH']), 'S')?.seat).toBe(1);
    expect(winningPlay(trick(['9H', 'AS']), null)?.seat).toBe(0);
    expect(winningPlay([], 'S')).toBeNull();
    expect(beats('2S', 'AH', 'H', 'S')).toBe(true);
    expect(beats('AD', '2H', 'H', 'S')).toBe(false);
  });
});
