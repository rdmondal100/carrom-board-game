import type { Card, Play } from '@hub/cards';
import { CB_ANIM, type CallbreakEvent, type CallbreakView } from '@hub/callbreak';

export type Cue = 'deal' | 'bid' | 'card' | 'trick' | 'round';

/** CB-7 one picture of the table while a change plays out. */
export interface Frame {
  trick: Play[];
  /** The trick's winner, highlighted while the full trick shows. */
  winner: number | null;
  hand: Card[];
  bids: (number | null)[];
  won: number[];
  /** A round just ended: its points per seat (tenths). */
  points: number[] | null;
  cue: Cue;
  ms: number;
}

/**
 * The frames between `start` and `end` (views of the same seat). Their times
 * add up to the server's `durationOf(events)`, so the clock starts as the
 * last frame ends. A new deal shows the end view's hand.
 */
export function framesFor(start: CallbreakView, events: readonly CallbreakEvent[], end: CallbreakView): Frame[] {
  let f: Omit<Frame, 'cue' | 'ms'> = {
    trick: [...start.trick], winner: null, hand: [...start.hand], bids: [...start.bids], won: [...start.won], points: null,
  };
  const out: Frame[] = [];
  const push = (cue: Cue, ms: number) => out.push({ ...f, cue, ms });
  for (const e of events) {
    if (e.type === 'deal') {
      f = { trick: [], winner: null, hand: [...end.hand], bids: end.bids.map(() => null), won: end.won.map(() => 0), points: null };
      push('deal', CB_ANIM.DEAL_MS);
    } else if (e.type === 'bid') {
      f = { ...f, bids: f.bids.map((b, i) => (i === e.seat ? e.bid : b)) };
      push('bid', CB_ANIM.BID_MS);
    } else if (e.type === 'play') {
      const hand = e.seat === start.seat ? f.hand.filter((c) => c !== e.card) : f.hand;
      f = { ...f, winner: null, trick: [...f.trick, { seat: e.seat, card: e.card }], hand };
      push('card', CB_ANIM.CARD_MS);
    } else if (e.type === 'trick') {
      f = { ...f, winner: e.winner, won: f.won.map((n, i) => (i === e.winner ? n + 1 : n)) };
      push('trick', CB_ANIM.TRICK_MS);
      f = { ...f, trick: [], winner: null };
    } else if (e.type === 'roundEnd') {
      f = { ...f, points: e.points };
      push('round', CB_ANIM.ROUND_MS);
      f = { ...f, points: null };
    }
  }
  return out;
}
