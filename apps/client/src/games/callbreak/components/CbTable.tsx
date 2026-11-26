import { Bot } from 'lucide-react';
import { motion } from 'motion/react';
import type { Play } from '@hub/cards';
import type { CardBackSkin, TableSkin } from '@/games/callbreak/skins';
import { formatPoints } from '@/games/callbreak/paths';
import { t } from '@/i18n/t';
import { cn } from '@/lib/utils';
import { CardBack } from './PlayingCard';
import { DealFlight, spotOf, TrickCard, type Spot } from './TrickMotion';

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
  /** MOT-4 a deal is playing: show backs flying to each seat. */
  dealing?: boolean;
}

/** A colour per seat for the avatar discs. */
const SEAT_TINT = ['#fbbf24', '#f472b6', '#22d3ee', '#a3e635'] as const;

/** A seat's name, call and tricks. `bare`: no grid place and no card thumbnail (the 3D table places it and shows the cards). */
export function SeatBadge({ seat, p, spot, bare = false }: { seat: number; p: TableProps; spot: Spot; bare?: boolean }) {
  const turn = p.turnSeat === seat;
  const bid = p.bids[seat];
  return (
    <div className={cn('flex min-w-0 flex-col items-center gap-1 rounded-2xl bg-black/25 px-2 py-1.5 text-xs backdrop-blur-sm transition', bare && 'gap-0.5 bg-black/45 px-1.5 py-1 text-[11px]', turn && 'bg-amber-400/25 ring-2 ring-amber-400 shadow-[0_0_20px_-2px_rgb(251_191_36/0.7)]', spot !== 'bottom' && !bare && SEAT_POS[spot])}
      aria-current={turn ? 'true' : undefined} data-testid={`seat-${seat}`} style={bare ? { color: '#fff' } : undefined}>
      {spot !== 'bottom' && !bare && (p.handSizes[seat] ?? 0) > 0 && <CardBack skin={p.back} size="sm" />}
      <span className={cn('grid size-8 place-items-center rounded-full font-display text-sm font-bold text-slate-900 ring-2 ring-white/60', bare && 'size-6 text-xs')} style={{ background: SEAT_TINT[seat % 4] }} aria-hidden>
        {(p.names[seat] ?? '?').slice(0, 1).toUpperCase()}
      </span>
      <span className="flex max-w-28 items-center gap-1 truncate font-medium">
        {p.names[seat]}{p.bots.includes(seat) && <Bot className="size-3 shrink-0" aria-label={t('callbreak.bot')} />}
        {p.dealer === seat && <span className="rounded bg-white/20 px-1" title={t('callbreak.dealer')}>D</span>}
      </span>
      <motion.span key={`${p.won[seat] ?? 0}/${bid ?? ''}`} className="tabular-nums opacity-90"
        initial={{ scale: 1.5, color: '#fbbf24' }} animate={{ scale: 1, color: bare ? '#ffffff' : p.table.text }} transition={{ type: 'spring', stiffness: 400, damping: 18 }}>
        {t('callbreak.wonOfBid', { won: p.won[seat] ?? 0, bid: bid ?? '–' })}
      </motion.span>
    </div>
  );
}

/** CB-7 the table: the other three seats round the edge (calls, tricks won, cards left) and the trick in the middle. */
export function CbTable(p: TableProps) {
  return (
    <div className="relative grid w-full max-w-xl grid-cols-[1fr_2fr_1fr] grid-rows-[auto_1fr_auto] gap-1 rounded-[2rem] border-[10px] p-2 shadow-[inset_0_0_50px_rgb(0_0_0/0.55),0_24px_50px_-18px_rgb(0_0_0/0.8)] ring-2 ring-amber-300/40"
      style={{
        background: `radial-gradient(ellipse at 50% 42%, color-mix(in srgb, ${p.table.felt} 72%, white) 0%, ${p.table.felt} 55%, color-mix(in srgb, ${p.table.felt} 65%, black) 100%)`,
        borderColor: p.table.rim, color: p.table.text,
      }} role="region" aria-label={t('callbreak.table')}>
      <span className="pointer-events-none absolute inset-0 m-auto h-fit w-fit font-display text-[9rem] leading-none opacity-[0.07] select-none" aria-hidden>♠</span>
      {[1, 2, 3].map((k) => {
        const seat = (p.me + k) % 4;
        return <SeatBadge key={seat} seat={seat} p={p} spot={spotOf(seat, p.me)} />;
      })}
      <div className="relative col-start-2 row-start-2 min-h-56 sm:min-h-64" data-testid="trick">
        {p.trick.map((play) => <TrickCard key={play.card} play={play} me={p.me} winner={p.winner} back={p.back} />)}
        {p.dealing && <DealFlight dealer={p.dealer} me={p.me} back={p.back} />}
        {p.points && <RoundPoints points={p.points} names={p.names} />}
      </div>
      <div className="col-span-3 row-start-3 justify-self-center"><SeatBadge seat={p.me} p={p} spot="bottom" /></div>
    </div>
  );
}

/** CB-7 a round's points per seat, over the middle of the table. */
export function RoundPoints({ points, names }: { points: readonly number[]; names: readonly string[] }) {
  return (
    <div className="absolute inset-0 z-10 m-auto flex h-fit w-fit animate-pop flex-col gap-1 rounded-2xl bg-black/75 p-4 text-sm text-white ring-1 ring-amber-300/40 backdrop-blur" role="status" data-testid="round-points">
      {points.map((pt, seat) => (
        <span key={seat} className="flex justify-between gap-4 tabular-nums"><span>{names[seat]}</span><span>{formatPoints(pt)}</span></span>
      ))}
    </div>
  );
}
