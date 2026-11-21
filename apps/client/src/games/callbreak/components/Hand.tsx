import type { Card } from '@hub/cards';
import { cn } from '@/lib/utils';
import { CardFace, cardLabel } from './PlayingCard';

interface HandProps {
  cards: readonly Card[];
  /** Cards you may play now; they are lifted and take taps. Empty = not your turn to play. */
  legal: readonly Card[];
  onPlay?: (card: Card) => void;
  label: string;
}

/** CB-7 your hand as an overlapping fan at the bottom: tap a lifted (legal) card to play it. */
export function Hand({ cards, legal, onPlay, label }: HandProps) {
  const playing = legal.length > 0;
  return (
    <div className="flex justify-center px-2 pt-4" role="group" aria-label={label} data-testid="hand">
      {cards.map((c, i) => {
        const ok = playing && legal.includes(c);
        const face = <CardFace card={c} size="md" className={cn('transition-transform', ok && '-translate-y-3 ring-2 ring-amber-400', playing && !ok && 'opacity-50')} />;
        return (
          <div key={c} className="-ml-10 first:ml-0 sm:-ml-6" style={{ zIndex: i }}>
            {ok && onPlay ? (
              <button type="button" onClick={() => onPlay(c)} aria-label={cardLabel(c)} data-testid={`card-${c}`} className="rounded-md focus-visible:outline-2 focus-visible:outline-amber-400">
                {face}
              </button>
            ) : <div data-testid={`card-${c}`}>{face}</div>}
          </div>
        );
      })}
    </div>
  );
}
