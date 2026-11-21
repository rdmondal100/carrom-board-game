import { useEffect, useRef, useState } from 'react';
import { Crown } from 'lucide-react';
import { CB, SEATS, totalsOf } from '@hub/callbreak';
import { RewardedAdButton, useGameEndAds } from '@/components/AdParts';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { formatPoints } from '@/games/callbreak/paths';
import { t } from '@/i18n/t';
import { cn } from '@/lib/utils';

const MS_PER_S = 1000;
const LOW_S = 5;

/** CB-4 the turn clock. Give it a new `key` each turn; `startMs` lets a rejoiner see less than a full clock. */
export function CbClock({ running, onExpire, startMs = CB.CLOCK_MS }: { running: boolean; onExpire: () => void; startMs?: number }) {
  const [left, setLeft] = useState(Math.min(startMs, CB.CLOCK_MS));
  const cb = useRef(onExpire);
  useEffect(() => { cb.current = onExpire; });
  useEffect(() => {
    if (!running) return;
    const end = Date.now() + left;
    const id = setInterval(() => {
      const ms = Math.max(0, end - Date.now());
      setLeft(ms);
      if (ms === 0) {
        clearInterval(id);
        cb.current();
      }
    }, 200);
    return () => clearInterval(id);
    // Restarting on every tick would reset `end`; only `running` restarts it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running]);
  const s = Math.ceil(left / MS_PER_S);
  return <span className={cn('tabular-nums text-sm', s <= LOW_S ? 'font-semibold text-red-400' : 'opacity-80')}>{t('clock.label', { s })}</span>;
}

/** CB-7 your call: 1..8 tricks, with the hand's sure-trick count as a hint. */
export function BidPicker({ suggested, onBid }: { suggested: number; onBid: (n: number) => void }) {
  const calls = Array.from({ length: CB.MAX_BID - CB.MIN_BID + 1 }, (_, i) => CB.MIN_BID + i);
  return (
    <div className="flex flex-col items-center gap-2" data-testid="bid-picker">
      <p className="text-sm font-medium">{t('callbreak.yourBid')}</p>
      <div className="flex flex-wrap justify-center gap-1.5">
        {calls.map((n) => (
          <Button key={n} size="sm" variant={n === suggested ? 'default' : 'outline'} className="w-10" onClick={() => onBid(n)}>{n}</Button>
        ))}
      </div>
      <p className="text-xs opacity-70">{t('callbreak.suggest', { n: suggested })}</p>
    </div>
  );
}

/** CB-3 / CB-7 points per round per seat and the running totals. */
export function ScoreSheet({ scores, names }: { scores: readonly (readonly number[])[]; names: readonly string[] }) {
  const totals = totalsOf(scores);
  return (
    <table className="w-full text-sm tabular-nums" data-testid="score-sheet">
      <thead>
        <tr><th className="text-left font-normal opacity-70">#</th>{SEATS.map((s) => <th key={s} className="truncate px-1 text-right font-medium">{names[s]}</th>)}</tr>
      </thead>
      <tbody>
        {scores.map((r, i) => (
          <tr key={i}><td className="opacity-70">{i + 1}</td>{SEATS.map((s) => <td key={s} className="px-1 text-right">{formatPoints(r[s] ?? 0)}</td>)}</tr>
        ))}
        <tr className="border-t border-border font-semibold">
          <td>{t('callbreak.total')}</td>{SEATS.map((s) => <td key={s} className="px-1 text-right">{formatPoints(totals[s] ?? 0)}</td>)}
        </tr>
      </tbody>
    </table>
  );
}

/** The score sheet in a dialog (the HUD's "Scores" button). */
export function ScoreDialog({ open, onClose, scores, names }: { open: boolean; onClose: () => void; scores: readonly (readonly number[])[]; names: readonly string[] }) {
  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="p-6">
        <DialogHeader><DialogTitle>{t('callbreak.scores')}</DialogTitle></DialogHeader>
        {scores.length > 0 ? <ScoreSheet scores={scores} names={names} /> : <p className="text-sm opacity-70">{t('callbreak.noScores')}</p>}
      </DialogContent>
    </Dialog>
  );
}

const stay = (e: Event) => e.preventDefault();

interface EndProps {
  winner: string;
  scores: readonly (readonly number[])[];
  names: readonly string[];
  onRematch: () => void;
  onHome: () => void;
  note?: string;
  rematchDisabled?: boolean;
}

/** CB-7 game end: winner, the full score sheet, rematch or home. AD-3 rewarded offer; AD-4 interstitial on the way out. */
export function CbEndDialog({ winner, scores, names, onRematch, onHome, note, rematchDisabled = false }: EndProps) {
  const { leaving, leave } = useGameEndAds();
  return (
    <Dialog open>
      <DialogContent className="p-6 text-center" onEscapeKeyDown={stay} onPointerDownOutside={stay}>
        <DialogHeader>
          <DialogTitle className="text-xl">{t('gameEnd.title')}</DialogTitle>
          <DialogDescription className="flex items-center justify-center gap-2 text-2xl font-semibold text-amber-300">
            <Crown className="size-6" />{t('gameEnd.winner', { name: winner })}
          </DialogDescription>
        </DialogHeader>
        <ScoreSheet scores={scores} names={names} />
        {note && <p className="text-sm text-muted-foreground" role="status">{note}</p>}
        <RewardedAdButton className="mx-auto" />
        <DialogFooter className="mt-2 flex-row justify-center">
          <Button autoFocus onClick={() => leave(onRematch)} disabled={rematchDisabled || leaving}>{t('gameEnd.rematch')}</Button>
          <Button variant="outline" onClick={() => leave(onHome)} disabled={leaving}>{t('gameEnd.home')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
