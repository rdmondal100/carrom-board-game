import { shuffle, type Rng } from '@hub/game-kit';

/** CB-1 suits: spades, hearts, diamonds, clubs. */
export const SUITS = ['S', 'H', 'D', 'C'] as const;
export type Suit = (typeof SUITS)[number];

/** Rank letters, lowest first: 2..9, T(en), J, Q, K, A. */
export const RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', 'T', 'J', 'Q', 'K', 'A'] as const;
export type RankChar = (typeof RANKS)[number];

/** A card as two letters, rank then suit: 'AS' ace of spades, 'TH' ten of hearts. */
export type Card = `${RankChar}${Suit}`;

/** Rank number of the lowest card (a 2); an ace is 14. */
const LOW_RANK = 2;

/** The 52-card deck, suit by suit, low to high. */
export const DECK: readonly Card[] = SUITS.flatMap((s) => RANKS.map((r): Card => `${r}${s}`));

export const suitOf = (c: Card): Suit => c[1] as Suit;
/** 2..14 (ace high). */
export const rankOf = (c: Card): number => RANKS.indexOf(c[0] as RankChar) + LOW_RANK;
export const isCard = (v: unknown): v is Card => typeof v === 'string' && (DECK as readonly string[]).includes(v);

/** CB-1 a seeded shuffle dealt round the table: `hands` hands of `size` cards (hand i gets every hands-th card). */
export function deal(rng: Rng, hands: number, size: number): [Card[][], Rng] {
  const [deck, next] = shuffle(DECK, rng);
  const out: Card[][] = Array.from({ length: hands }, () => []);
  for (let i = 0; i < hands * size; i++) out[i % hands]!.push(deck[i]!);
  return [out.map(sortHand), next];
}

/** Hand order for display: spades, hearts, clubs, diamonds (colours alternate), high to low. */
const DISPLAY_SUITS: readonly Suit[] = ['S', 'H', 'C', 'D'];
export function sortHand(hand: readonly Card[]): Card[] {
  return [...hand].sort((a, b) => DISPLAY_SUITS.indexOf(suitOf(a)) - DISPLAY_SUITS.indexOf(suitOf(b)) || rankOf(b) - rankOf(a));
}

/** One card played to a trick. */
export interface Play { seat: number; card: Card }

/** Does `a` beat `b` in a trick led with `led`, with `trump` as trumps? */
export function beats(a: Card, b: Card, led: Suit, trump: Suit | null): boolean {
  const sa = suitOf(a);
  const sb = suitOf(b);
  if (sa === sb) return rankOf(a) > rankOf(b);
  if (trump !== null && sa === trump) return true;
  if (trump !== null && sb === trump) return false;
  return sa === led;
}

/** CB-1 the play winning the trick so far (the first card leads). */
export function winningPlay(trick: readonly Play[], trump: Suit | null): Play | null {
  const first = trick[0];
  if (!first) return null;
  const led = suitOf(first.card);
  return trick.reduce((best, p) => (beats(p.card, best.card, led, trump) ? p : best), first);
}
