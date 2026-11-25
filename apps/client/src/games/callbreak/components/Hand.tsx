import { motion } from 'motion/react';
import type { Card } from '@hub/cards';
import { cn } from '@/lib/utils';
import { CardFace, cardLabel } from './PlayingCard';

const FAN_DEG = 2.2;
const FAN_DIP = 0.5;
/** MOT-4 seconds between cards as a new hand fans in (13 cards fit inside the deal). */
const DEAL_STAGGER_S = 0.045;
const SPRING = { type: 'spring', stiffness: 260, damping: 26 } as const;

interface HandProps {
  cards: readonly Card[];
  /** Cards you may play now; they are lifted and take taps. Empty = not your turn to play. */
  legal: readonly Card[];
  onPlay?: (card: Card) => void;
  label: string;
  /** A deal is playing: new cards fan in one after another. */
  dealing?: boolean;
}

/**
 * CB-7 your hand as an overlapping fan at the bottom: tap a lifted (legal) card to play it.
 * MOT-4 each card shares its `layoutId` with the trick, so a played card flies there,
 * and the rest close the gap with a spring.
 */
export function Hand({ cards, legal, onPlay, label, dealing = false }: HandProps) {
  const playing = legal.length > 0;
  return (
    <div className="flex justify-center px-2 pt-5 pb-2" role="group" aria-label={label} data-testid="hand">
      {cards.map((c, i) => {
        const ok = playing && legal.includes(c);
        const face = <CardFace card={c} size="md" className={cn('transition-all duration-200', ok && '-translate-y-4 ring-2 ring-amber-400 shadow-amber-500/40 hover:-translate-y-6', playing && !ok && 'brightness-50')} />;
        // A gentle fan: cards turn and dip away from the middle.
        const off = i - (cards.length - 1) / 2;
        return (
          <motion.div key={c} layoutId={`card-${c}`} layout className="-ml-10 first:ml-0 sm:-ml-6"
            style={{ zIndex: i, transformOrigin: '50% 120%' }}
            initial={{ y: -240, opacity: 0, rotate: -30, scale: 0.6 }}
            animate={{ y: off * off * FAN_DIP, rotate: off * FAN_DEG, opacity: 1, scale: 1 }}
            transition={{ ...SPRING, delay: dealing ? i * DEAL_STAGGER_S : 0 }}>
            {ok && onPlay ? (
              <button type="button" onClick={() => onPlay(c)} aria-label={cardLabel(c)} data-testid={`card-${c}`} className="rounded-md focus-visible:outline-2 focus-visible:outline-amber-400">
                {face}
              </button>
            ) : <div data-testid={`card-${c}`}>{face}</div>}
          </motion.div>
        );
      })}
    </div>
  );
}
