import { Bot } from 'lucide-react';
import type { Play } from '@hub/cards';
import type { CardBackSkin, TableSkin } from '@/games/callbreak/skins';
import { formatPoints } from '@/games/callbreak/paths';
import { t } from '@/i18n/t';
import { cn } from '@/lib/utils';
import { CardBack, CardFace } from './PlayingCard';

/** Where a seat sits as seen by the viewer: 0 bottom (you), 1 left, 2 top, 3 right (play goes round clockwise). */
const SPOT = ['bottom', 'left', 'top', 'right'] as const;
type Spot = (typeof SPOT)[number];
const spotOf = (seat: number, me: number): Spot => SPOT[(seat - me + 4) % 4]!;

const TRICK_POS: Record<Spot, string> = {
  bottom: 'left-1/2 bottom-1 -translate-x-1/2', top: 'left-1/2 top-1 -translate-x-1/2',
  left: 'left-1 top-1/2 -translate-y-1/2', right: 'right-1 top-1/2 -translate-y-1/2',
};
const SEAT_POS: Record<Exclude<Spot, 'bottom'>, string> = {
  top: 'col-start-2 row-start-1 justify-self-center', left: 'col-start-1 row-start-2 self-center', right: 'col-start-3 row-start-2 self-center justify-self-end',
};

export interface TableProps {
  me: number;
  names: readonly string[];
  bids: readonly (number | null)[];
  won: readonly number[];
  handSizes: readonly number[];
  trick: readonly Play[];
  /** The trick's winner (highlighted while the full trick shows). */
  winner: number | null;
  turnSeat: number | null;
  dealer: number;
  bots: readonly number[];
  /** A round's points to show over the table (tenths), or null. */
  points: readonly number[] | null;
  back: CardBackSkin;
  table: TableSkin;
}

function SeatBadge({ seat, p, spot }: { seat: number; p: TableProps; spot: Spot }) {
  const turn = p.turnSeat === seat;
  const bid = p.bids[seat];
  return (
    <div className={cn('flex min-w-0 flex-col items-center gap-1 rounded-lg px-2 py-1 text-xs', turn && 'bg-amber-400/25 ring-2 ring-amber-400', spot !== 'bottom' && SEAT_POS[spot])}
      aria-current={turn ? 'true' : undefined} data-testid={`seat-${seat}`}>
      {spot !== 'bottom' && (p.handSizes[seat] ?? 0) > 0 && <CardBack skin={p.back} size="sm" />}
      <span className="flex max-w-28 items-center gap-1 truncate font-medium">
        {p.names[seat]}{p.bots.includes(seat) && <Bot className="size-3 shrink-0" aria-label={t('callbreak.bot')} />}
        {p.dealer === seat && <span className="rounded bg-white/20 px-1" title={t('callbreak.dealer')}>D</span>}
      </span>
      <span className="tabular-nums opacity-90">{t('callbreak.wonOfBid', { won: p.won[seat] ?? 0, bid: bid ?? '–' })}</span>
    </div>
  );
}

/** CB-7 the table: the other three seats round the edge (calls, tricks won, cards left) and the trick in the middle. */
export function CbTable(p: TableProps) {
  return (
    <div className="grid w-full max-w-xl grid-cols-[1fr_2fr_1fr] grid-rows-[auto_1fr_auto] gap-1 rounded-2xl border-4 p-2"
      style={{ background: p.table.felt, borderColor: p.table.rim, color: p.table.text }} role="region" aria-label={t('callbreak.table')}>
      {[1, 2, 3].map((k) => {
        const seat = (p.me + k) % 4;
        return <SeatBadge key={seat} seat={seat} p={p} spot={spotOf(seat, p.me)} />;
      })}
      <div className="relative col-start-2 row-start-2 min-h-56 sm:min-h-64" data-testid="trick">
        {p.trick.map((play) => (
          <div key={play.card} className={cn('absolute transition-all', TRICK_POS[spotOf(play.seat, p.me)])}>
            <CardFace card={play.card} size="md" className={cn('max-sm:scale-75', p.winner === play.seat && 'ring-4 ring-amber-400')} />
          </div>
        ))}
        {p.points && (
          <div className="absolute inset-0 m-auto flex h-fit w-fit flex-col gap-1 rounded-lg bg-black/70 p-3 text-sm" role="status" data-testid="round-points">
            {p.points.map((pt, seat) => (
              <span key={seat} className="flex justify-between gap-4 tabular-nums"><span>{p.names[seat]}</span><span>{formatPoints(pt)}</span></span>
            ))}
          </div>
        )}
      </div>
      <div className="col-span-3 row-start-3 justify-self-center"><SeatBadge seat={p.me} p={p} spot="bottom" /></div>
    </div>
  );
}
