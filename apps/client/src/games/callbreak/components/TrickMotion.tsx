import { motion } from 'motion/react';
import type { Play } from '@hub/cards';
import { CB_ANIM } from '@hub/callbreak';
import type { CardBackSkin } from '@/games/callbreak/skins';
import { cn } from '@/lib/utils';
import { CardBack, FlipCard } from './PlayingCard';

/** Where a seat sits as seen by the viewer: 0 bottom (you), 1 left, 2 top, 3 right (play goes round clockwise). */
const SPOT = ['bottom', 'left', 'top', 'right'] as const;
export type Spot = (typeof SPOT)[number];
export const spotOf = (seat: number, me: number): Spot => SPOT[(seat - me + 4) % 4]!;

const TRICK_POS: Record<Spot, string> = {
  bottom: 'left-1/2 bottom-1 -translate-x-1/2', top: 'left-1/2 top-1 -translate-x-1/2',
  left: 'left-1 top-1/2 -translate-y-1/2', right: 'right-1 top-1/2 -translate-y-1/2',
};

interface Pt { x: number; y: number }
/** Where an opponent's card starts (px from its trick spot): out at their seat. */
const FROM: Record<Spot, Pt> = { bottom: { x: 0, y: 200 }, top: { x: 0, y: -150 }, left: { x: -150, y: -10 }, right: { x: 150, y: -10 } };
/** A won trick first slides together (px from each card's spot)... */
const GATHER: Record<Spot, Pt> = { bottom: { x: 0, y: -52 }, top: { x: 0, y: 52 }, left: { x: 72, y: 0 }, right: { x: -72, y: 0 } };
/** ...then sweeps off toward the winner's seat. */
const SWEEP: Record<Spot, Pt> = { bottom: { x: 0, y: 260 }, top: { x: 0, y: -230 }, left: { x: -230, y: 0 }, right: { x: 230, y: 0 } };

/** A small, steady tilt per card so the pile looks thrown, not placed. */
function tiltOf(card: string): number {
  let h = 0;
  for (let i = 0; i < card.length; i++) h = (h * 31 + card.charCodeAt(i)) % 997;
  return (h % 17) - 8;
}

const LAND = { type: 'spring', stiffness: 240, damping: 22, mass: 0.9 } as const;

interface TrickCardProps {
  play: Play;
  me: number;
  /** The trick's winner while the full trick shows, else null. */
  winner: number | null;
  back: CardBackSkin;
}

/**
 * MOT-4 one card of the trick. Yours flies in from your hand (shared `layoutId`);
 * another seat's is thrown from their side and turns face up on the way. When the
 * trick is won the cards gather, wait a beat, and sweep to the winner.
 */
export function TrickCard({ play, me, winner, back }: TrickCardProps) {
  const spot = spotOf(play.seat, me);
  const mine = play.seat === me;
  const tilt = tiltOf(play.card);
  const g = GATHER[spot];
  const w = winner !== null ? SWEEP[spotOf(winner, me)] : null;
  return (
    <motion.div layoutId={mine ? `card-${play.card}` : undefined} className={cn('absolute', TRICK_POS[spot])}
      style={{ zIndex: 1 }}
      initial={mine ? false : { x: FROM[spot].x, y: FROM[spot].y, rotate: tilt * 4, opacity: 0, scale: 0.75 }}
      animate={w
        ? { x: [0, g.x, g.x, g.x + w.x], y: [0, g.y, g.y, g.y + w.y], rotate: [tilt, tilt / 2, tilt / 2, 0], scale: [1, 1, 1, 0.55], opacity: [1, 1, 1, 0] }
        : { x: 0, y: 0, rotate: tilt, opacity: 1, scale: 1 }}
      transition={w ? { duration: CB_ANIM.TRICK_MS / 1000, times: [0, 0.3, 0.6, 1], ease: 'easeInOut' } : LAND}>
      <FlipCard card={play.card} back={back} size="md" fromBack={!mine}
        className={cn('max-sm:scale-75 shadow-lg', winner === play.seat && 'ring-4 ring-amber-400')} />
    </motion.div>
  );
}

/** Backs per seat shown flying out on a deal (a token of the 13 each gets). */
const DEAL_BACKS = 3;
/** 12 backs × step + flight stay inside CB_ANIM.DEAL_MS. */
const DEAL_STEP_S = 0.042;
/** Where a dealt card lands, from the table's centre (px). */
const DEAL_TO: Record<Spot, Pt> = { bottom: { x: 0, y: 260 }, top: { x: 0, y: -190 }, left: { x: -190, y: 0 }, right: { x: 190, y: 0 } };

/** MOT-4 the deal: backs leave the dealer's side one by one, round the table from the dealer's left. */
export function DealFlight({ dealer, me, back }: { dealer: number; me: number; back: CardBackSkin }) {
  const from = DEAL_TO[spotOf(dealer, me)];
  const cards = Array.from({ length: DEAL_BACKS * 4 }, (_, i) => ({ i, seat: (dealer + 1 + i) % 4 }));
  return (
    <div className="pointer-events-none absolute top-1/2 left-1/2 z-20" aria-hidden>
      {cards.map(({ i, seat }) => {
        const to = DEAL_TO[spotOf(seat, me)];
        return (
          <motion.div key={i} className="absolute -translate-x-1/2 -translate-y-1/2"
            initial={{ x: from.x * 0.4, y: from.y * 0.4, rotate: 0, opacity: 0 }}
            animate={{ x: [from.x * 0.4, to.x], y: [from.y * 0.4, to.y], rotate: [0, 180 + i * 7], opacity: [1, 1, 0] }}
            transition={{ duration: 0.38, delay: i * DEAL_STEP_S, ease: 'easeOut', opacity: { duration: 0.38, delay: i * DEAL_STEP_S, times: [0, 0.8, 1] } }}>
            <CardBack skin={back} size="sm" />
          </motion.div>
        );
      })}
    </div>
  );
}
