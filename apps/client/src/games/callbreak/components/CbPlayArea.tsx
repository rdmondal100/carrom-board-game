import type { ReactNode } from 'react';
import { LayoutGroup } from 'motion/react';
import type { Card } from '@hub/cards';
import { bidFor, legalCards, type CallbreakView } from '@hub/callbreak';
import type { Frame } from '@/games/callbreak/playback';
import type { CbLook } from '@/games/callbreak/skins';
import { t } from '@/i18n/t';
import { BidPicker } from './CbParts';
import { CbTableView } from './CbTableView';
import { Hand } from './Hand';

interface Props {
  /** The settled view of the seat at the bottom. */
  view: CallbreakView;
  /** While a change plays out, what the table shows instead. */
  frame: Frame | null;
  me: number;
  names: readonly string[];
  bots: readonly number[];
  /** You may act now (your turn, nothing playing, nothing sent). */
  canAct: boolean;
  onBid: (n: number) => void;
  onPlay: (card: Card) => void;
  look: CbLook;
  /** Status line and controls under the table (clock, take back). */
  children?: ReactNode;
}

/** CB-7 the table, your call or your hand, and whatever the page adds in between. */
export function CbPlayArea({ view, frame, me, names, bots, canAct, onBid, onPlay, look, children }: Props) {
  const hand = frame?.hand ?? view.hand;
  const bidding = canAct && !frame && view.phase === 'bid';
  const legal = canAct && !frame && view.phase === 'play' ? legalCards(view.hand, view.trick) : [];
  const dealing = frame?.cue === 'deal';
  // MOT-4 one layout group, so a card leaving the hand flies to its trick spot.
  return (
    <LayoutGroup>
      <div className="flex min-h-0 flex-1 flex-col items-center gap-2">
        <CbTableView me={me} names={names} bids={frame?.bids ?? view.bids} won={frame?.won ?? view.won} handSizes={view.handSizes}
          trick={frame?.trick ?? view.trick} winner={frame?.winner ?? null} turnSeat={frame || view.winner !== null ? null : view.turnSeat}
          dealer={view.dealer} bots={bots} points={frame?.points ?? null} back={look.back} table={look.table} dealing={dealing} />
        <div className="flex min-h-10 flex-col items-center gap-1">{children}</div>
        {bidding && <BidPicker suggested={bidFor(view.hand, 'medium', 0)} onBid={onBid} />}
        <Hand cards={hand} legal={legal} onPlay={onPlay} label={t('callbreak.hand')} dealing={dealing} />
      </div>
    </LayoutGroup>
  );
}
