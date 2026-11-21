import { beats, DECK, rankOf, suitOf, winningPlay, type Card, type Suit } from '@hub/cards';
import { nextInt, type BotLevel } from '@hub/game-kit';
import { CB } from './config';
import { legalCards, TRUMP } from './rules';
import type { CallbreakMove, CallbreakView } from './types';

const ACE = 14;
const KING = 13;
const QUEEN = 12;
const JACK = 11;
/** Spades past this many count as a sure trick each. */
const LONG_SPADES = 4;

const bySuit = (hand: readonly Card[], s: Suit) => hand.filter((c) => suitOf(c) === s);
const lowest = (cards: readonly Card[]): Card => cards.reduce((a, b) => (rankOf(b) < rankOf(a) ? b : a));
const highest = (cards: readonly Card[]): Card => cards.reduce((a, b) => (rankOf(b) > rankOf(a) ? b : a));
/** Cheapest card to give away: a low non-spade before any spade. */
const cheapest = (cards: readonly Card[]): Card => {
  const plain = cards.filter((c) => suitOf(c) !== TRUMP);
  return lowest(plain.length > 0 ? plain : cards);
};

/** CB-6 sure tricks in a hand: high spades, long spades, aces, guarded kings, and ruffs from short suits. */
export function estimateTricks(hand: readonly Card[]): number {
  const spades = bySuit(hand, TRUMP).map(rankOf);
  const n = spades.length;
  let est = 0;
  if (spades.includes(ACE)) est += 1;
  if (spades.includes(KING)) est += n >= 2 ? 1 : 0.5;
  if (spades.includes(QUEEN)) est += n >= 3 ? 1 : 0.3;
  if (spades.includes(JACK) && n >= LONG_SPADES) est += 0.5;
  est += Math.max(0, n - LONG_SPADES);
  let spare = Math.max(0, n - 2); // spades not needed to draw trumps can ruff
  for (const s of ['H', 'D', 'C'] as const) {
    const ranks = bySuit(hand, s).map(rankOf);
    if (ranks.includes(ACE)) est += ranks.length <= 5 ? 1 : 0.5;
    if (ranks.includes(KING) && ranks.length >= 2) est += ranks.includes(ACE) && ranks.length <= 4 ? 0.8 : 0.4;
    const ruffs = Math.min(spare, Math.max(0, 2 - ranks.length));
    est += ruffs * 0.8;
    spare -= ruffs;
  }
  return est;
}

/** CB-6 the call: sure tricks, rounded, kept to 1..8. Easy adds noise. */
export function bidFor(hand: readonly Card[], level: BotLevel, seed: number): number {
  let est = Math.round(estimateTricks(hand));
  if (level === 'easy') est += nextInt({ seed }, 3)[0] - 1;
  return Math.min(CB.MAX_BID, Math.max(CB.MIN_BID, est));
}

/** Cards nobody has shown this seat: not in its hand and (hard: never played this round; others: not on the table). */
function unseenCards(v: CallbreakView, memory: boolean): Card[] {
  const seen = new Set<Card>([...v.hand, ...v.trick.map((p) => p.card)]);
  if (memory) for (const t of v.tricks) for (const p of t) seen.add(p.card);
  return DECK.filter((c) => !seen.has(c));
}

/** No unseen card of its suit is higher: it wins if its suit is led and nobody trumps. */
const isBoss = (c: Card, unseen: readonly Card[]) => !unseen.some((u) => suitOf(u) === suitOf(c) && rankOf(u) > rankOf(c));

/** Hard: seats that showed they hold none of a suit (didn't follow it). */
function voids(v: CallbreakView): Map<number, Set<Suit>> {
  const out = new Map<number, Set<Suit>>();
  for (const t of [...v.tricks, v.trick]) {
    const led = t[0] ? suitOf(t[0].card) : null;
    for (const p of t.slice(1)) {
      if (led === null || suitOf(p.card) === led) continue;
      const set = out.get(p.seat) ?? new Set<Suit>();
      set.add(led);
      if (suitOf(p.card) !== TRUMP) set.add(TRUMP);
      out.set(p.seat, set);
    }
  }
  return out;
}

function lead(v: CallbreakView, need: number, hard: boolean): Card {
  const hand = v.hand;
  if (need <= 0) return cheapest(hand);
  const unseen = unseenCards(v, hard);
  const opp = hard ? voids(v) : new Map<number, Set<Suit>>();
  const ruffed = (s: Suit) => [...opp.entries()].some(([seat, set]) => seat !== v.seat && set.has(s) && !set.has(TRUMP));
  const bosses = hand.filter((c) => suitOf(c) !== TRUMP && isBoss(c, unseen) && !ruffed(suitOf(c)));
  if (bosses.length > 0) return highest(bosses);
  const spades = bySuit(hand, TRUMP);
  if (hard && spades.length > 0 && isBoss(highest(spades), unseen) && spades.length >= LONG_SPADES) return highest(spades);
  // Lead low from the shortest side suit, to run out of it and trump later.
  const sides = (['H', 'D', 'C'] as const).map((s) => bySuit(hand, s)).filter((l) => l.length > 0 && !(hard && ruffed(suitOf(l[0]!))));
  if (sides.length === 0) return cheapest(hand);
  return lowest(sides.reduce((a, b) => (b.length < a.length ? b : a)));
}

function follow(v: CallbreakView, legal: readonly Card[], need: number, hard: boolean): Card {
  const best = winningPlay(v.trick, TRUMP)!;
  const led = suitOf(v.trick[0]!.card);
  const winners = legal.filter((c) => beats(c, best.card, led, TRUMP));
  const losers = legal.filter((c) => !winners.includes(c));
  const last = v.trick.length === CB.SEATS - 1;
  if (need <= 0) return losers.length > 0 ? highest(losers) : lowest(winners); // duck: the call is made
  if (winners.length === 0) return cheapest(legal);
  if (last) return lowest(winners);
  const unseen = unseenCards(v, hard);
  const trumping = winners.filter((c) => suitOf(c) === TRUMP && led !== TRUMP);
  if (trumping.length > 0) return lowest(trumping);
  const safe = winners.filter((c) => isBoss(c, unseen));
  if (safe.length > 0) return lowest(safe);
  return cheapest(legal);
}

/**
 * CB-6 a move for the seat whose view this is. It sees only its own hand and
 * what was played. Easy: a noisy call and any legal card. Medium: rules of
 * thumb (win cheaply, duck once the call is made, keep spades). Hard: medium
 * plus every card played this round and the suits others are out of.
 */
export function callbreakBot(v: CallbreakView, level: BotLevel, seed: number): CallbreakMove {
  if (v.phase === 'bid') return { bid: bidFor(v.hand, level, seed) };
  const legal = legalCards(v.hand, v.trick);
  if (level === 'easy') return { card: legal[nextInt({ seed }, legal.length)[0]]! };
  const me = v.seat ?? v.turnSeat;
  const need = (v.bids[me] ?? 0) - (v.won[me] ?? 0);
  const hard = level === 'hard';
  return { card: v.trick.length === 0 ? lead(v, need, hard) : follow(v, legal, need, hard) };
}
