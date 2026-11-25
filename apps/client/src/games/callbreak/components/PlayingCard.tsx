import { motion } from 'motion/react';
import { rankOf, suitOf, type Card, type Suit } from '@hub/cards';
import type { CardBackSkin } from '@/games/callbreak/skins';
import { cn } from '@/lib/utils';

export const SUIT_SYMBOL: Record<Suit, string> = { S: '♠', H: '♥', D: '♦', C: '♣' };
const RANK_LABEL: Record<number, string> = { 10: '10', 11: 'J', 12: 'Q', 13: 'K', 14: 'A' };
const isRed = (c: Card) => suitOf(c) === 'H' || suitOf(c) === 'D';
const rankText = (c: Card): string => RANK_LABEL[rankOf(c)] ?? String(rankOf(c));
const FACE_RANKS = new Set([11, 12, 13]);

/** "A♠", "10♥": the short name of a card (also its accessible label). */
export const cardLabel = (c: Card): string => `${RANK_LABEL[rankOf(c)] ?? String(rankOf(c))}${SUIT_SYMBOL[suitOf(c)]}`;

const SIZES = { sm: 'h-14 w-10 text-xs', md: 'h-24 w-16 text-sm', lg: 'h-28 w-20 text-lg' } as const;
export type CardSize = keyof typeof SIZES;

/** A corner index: rank over suit. */
function Corner({ card, className }: { card: Card; className?: string }) {
  return (
    <span className={cn('flex w-fit flex-col items-center leading-[0.95]', className)} aria-hidden>
      <span>{rankText(card)}</span><span className="text-[0.85em]">{SUIT_SYMBOL[suitOf(card)]}</span>
    </span>
  );
}

/** CB-7 a card face: corner indices, a big suit in the middle (a framed letter on J, Q, K). Our own design. */
export function CardFace({ card, size = 'md', className }: { card: Card; size?: CardSize; className?: string }) {
  const face = FACE_RANKS.has(rankOf(card));
  return (
    <div className={cn('relative flex shrink-0 select-none flex-col rounded-lg border border-black/10 bg-linear-to-br from-white via-white to-slate-200 p-1 font-bold shadow-md shadow-black/40',
      isRed(card) ? 'text-red-600' : 'text-slate-900', SIZES[size], className)} aria-label={cardLabel(card)} data-card={card}>
      <Corner card={card} />
      {face ? (
        <span className="m-auto grid place-items-center rounded-md border border-current/30 bg-linear-to-b from-amber-100 to-amber-200/70 px-1.5 font-display text-[1.5em] leading-none" aria-hidden>
          {rankText(card)}<span className="text-[0.6em]">{SUIT_SYMBOL[suitOf(card)]}</span>
        </span>
      ) : (
        <span className="m-auto text-[1.9em] leading-none drop-shadow-sm" aria-hidden>{SUIT_SYMBOL[suitOf(card)]}</span>
      )}
      {size !== 'sm' && <Corner card={card} className="absolute right-1 bottom-1 rotate-180" />}
    </div>
  );
}

/** CB-9 the back of a card in the equipped design. */
export function CardBack({ skin, size = 'md', className }: { skin: CardBackSkin; size?: CardSize; className?: string }) {
  const id = `back-${skin.pattern}`;
  return (
    <div className={cn('shrink-0 overflow-hidden rounded-lg border-2 shadow-md shadow-black/40', SIZES[size], className)} style={{ borderColor: skin.border, background: skin.base }}
      data-testid="card-back">
      <svg viewBox="0 0 40 56" className="size-full" aria-hidden preserveAspectRatio="none">
        <defs>
          <pattern id={id} width="8" height="8" patternUnits="userSpaceOnUse">
            {skin.pattern === 'lattice' && <path d="M0 4 L4 0 L8 4 L4 8 Z" fill="none" stroke={skin.ink} strokeWidth="0.8" />}
            {skin.pattern === 'nakshi' && <circle cx="4" cy="4" r="2" fill="none" stroke={skin.ink} strokeWidth="0.8" />}
            {skin.pattern === 'jamdani' && <path d="M4 1 L5 4 L4 7 L3 4 Z" fill={skin.ink} />}
            {skin.pattern === 'royal' && <path d="M1 6 L2 2 L4 4 L6 2 L7 6 Z" fill={skin.ink} />}
          </pattern>
        </defs>
        <rect x="3" y="3" width="34" height="50" rx="3" fill={`url(#${id})`} stroke={skin.ink} strokeWidth="1" />
      </svg>
    </div>
  );
}

const FLIP_S = 0.4;

/** MOT-4 a card with both sides: starts face down when `fromBack` and turns face up. */
export function FlipCard({ card, back, size = 'md', fromBack, className }: { card: Card; back: CardBackSkin; size?: CardSize; fromBack: boolean; className?: string }) {
  return (
    <motion.div className="relative [transform-style:preserve-3d]" style={{ transformPerspective: 700 }}
      initial={fromBack ? { rotateY: 180 } : false} animate={{ rotateY: 0 }} transition={{ duration: FLIP_S, ease: [0.3, 0.7, 0.3, 1] }}>
      <CardFace card={card} size={size} className={cn('[backface-visibility:hidden]', className)} />
      <div className="absolute inset-0 [backface-visibility:hidden] [transform:rotateY(180deg)]" aria-hidden>
        <CardBack skin={back} size={size} className={className} />
      </div>
    </motion.div>
  );
}
