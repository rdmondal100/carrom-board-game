import { rankOf, suitOf, type Card, type Suit } from '@hub/cards';
import type { CardBackSkin } from '@/games/callbreak/skins';
import { cn } from '@/lib/utils';

export const SUIT_SYMBOL: Record<Suit, string> = { S: '♠', H: '♥', D: '♦', C: '♣' };
const RANK_LABEL: Record<number, string> = { 10: '10', 11: 'J', 12: 'Q', 13: 'K', 14: 'A' };
const isRed = (c: Card) => suitOf(c) === 'H' || suitOf(c) === 'D';

/** "A♠", "10♥": the short name of a card (also its accessible label). */
export const cardLabel = (c: Card): string => `${RANK_LABEL[rankOf(c)] ?? String(rankOf(c))}${SUIT_SYMBOL[suitOf(c)]}`;

const SIZES = { sm: 'h-14 w-10 text-xs', md: 'h-24 w-16 text-sm', lg: 'h-28 w-20 text-lg' } as const;
export type CardSize = keyof typeof SIZES;

/** CB-7 a card face: rank and suit in the corner, a big suit in the middle. Our own simple design. */
export function CardFace({ card, size = 'md', className }: { card: Card; size?: CardSize; className?: string }) {
  return (
    <div className={cn('relative flex shrink-0 select-none flex-col rounded-md border border-black/20 bg-white p-1 font-semibold shadow',
      isRed(card) ? 'text-red-600' : 'text-slate-900', SIZES[size], className)} aria-label={cardLabel(card)} data-card={card}>
      <span className="leading-none">{cardLabel(card)}</span>
      <span className="m-auto text-[1.8em] leading-none" aria-hidden>{SUIT_SYMBOL[suitOf(card)]}</span>
    </div>
  );
}

/** CB-9 the back of a card in the equipped design. */
export function CardBack({ skin, size = 'md', className }: { skin: CardBackSkin; size?: CardSize; className?: string }) {
  const id = `back-${skin.pattern}`;
  return (
    <div className={cn('shrink-0 overflow-hidden rounded-md border-2 shadow', SIZES[size], className)} style={{ borderColor: skin.border, background: skin.base }}
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
