import { useEffect, useRef, useState } from 'react';
import { Bot, Crown } from 'lucide-react';
import type { ServerMessage } from '@carrom/protocol';
import { LUDO, type LudoView } from '@hub/ludo';
import { RewardedAdButton, useGameEndAds } from '@/components/AdParts';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { seatColor } from '@/games/ludo/skins';
import { t } from '@/i18n/t';
import { formatDelta } from '@/store/rankedSlice';
import { cn } from '@/lib/utils';

const MS_PER_S = 1000;
const LOW_S = 5;

/**
 * LUDO-4 the turn clock (LUDO.CLOCK_MS, like carrom's shot clock). Give it a
 * new `key` each turn. `startMs` lets a rejoining player see less than a full clock.
 */
export function LudoClock({ running, onExpire, startMs = LUDO.CLOCK_MS }: { running: boolean; onExpire: () => void; startMs?: number }) {
  const [left, setLeft] = useState(Math.min(startMs, LUDO.CLOCK_MS));
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

interface StripProps {
  view: Pick<LudoView, 'config' | 'tokens' | 'turnSeat' | 'winner'>;
  seats: readonly number[];
  names: readonly string[];
  /** Seats the computer plays right now. */
  bots: readonly number[];
  me?: number | null;
}

/** LUDO-6 HUD: each seat's colour, name, tokens home, and whose turn it is. */
export function PlayerStrip({ view, seats, names, bots, me = null }: StripProps) {
  return (
    <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4" data-testid="ludo-players">
      {seats.map((s) => {
        const home = (view.tokens[s] ?? []).filter((p) => p === LUDO.HOME).length;
        const turn = view.winner === null && view.turnSeat === s;
        return (
          <div key={s} className={cn('flex items-center gap-2 rounded-md border px-2 py-1 text-sm', turn ? 'border-amber-400 bg-amber-400/10' : 'border-border')}
            aria-current={turn ? 'true' : undefined}>
            <span className="size-3 shrink-0 rounded-full" style={{ background: seatColor(s) }} />
            <span className="min-w-0 flex-1 truncate">{names[s]}{me === s && ` (${t('lobby.you')})`}</span>
            {bots.includes(s) && <Bot className="size-3.5 opacity-70" aria-label={t('ludo.bot')} />}
            <span className="tabular-nums text-xs opacity-70">{t('ludo.home', { n: home })}</span>
          </div>
        );
      })}
    </div>
  );
}

interface EndProps {
  winner: string;
  /** Names in finishing order (place, name). */
  standings: readonly { place: number; name: string }[];
  onRematch: () => void;
  onHome: () => void;
  note?: string;
  rematchDisabled?: boolean;
}

const stay = (e: Event) => e.preventDefault();

/** LUDO-6 game end: winner, places, rematch or home. AD-3 rewarded offer; AD-4 interstitial on the way out. */
export function LudoEndDialog({ winner, standings, onRematch, onHome, note, rematchDisabled = false }: EndProps) {
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
        <ol className="flex flex-col gap-1 text-sm">
          {standings.map((s) => <li key={s.name} className="tabular-nums">{t('ludo.place', { n: s.place, name: s.name })}</li>)}
        </ol>
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

/** Seat names in place order for the end dialog (2v2 lists each partner). */
export function standingsOf(placings: readonly number[], seats: readonly number[], names: readonly string[]): { place: number; name: string }[] {
  return seats.map((s, i) => ({ place: placings[i] ?? seats.length, name: names[s] ?? '' })).sort((a, b) => a.place - b.place);
}

type RankedResult = Extract<ServerMessage, { type: 'rankedResult' }>;

/** LUDO-7 / RANK-8 ranked Ludo over: win or loss (ranked is 1v1, so the winner is a seat) and the rating change. */
export function LudoRankedResult({ result, userId, onAgain, onHome }: { result: RankedResult | null; userId: string | null; onAgain: () => void; onHome: () => void }) {
  const { leaving, leave } = useGameEndAds();
  const mine = result?.players.find((p) => p.userId === userId);
  const won = mine !== undefined && result !== null && String(mine.seat) === result.winner;
  const title = !result ? 'ranked.saving' : result.abandoned ? (won ? 'ranked.abandonWin' : 'ranked.abandonLoss') : won ? 'ranked.win' : 'ranked.loss';
  return (
    <Dialog open>
      <DialogContent className="p-6 text-center" onEscapeKeyDown={stay} onPointerDownOutside={stay}>
        <DialogHeader>
          <DialogTitle className="text-xl">{t('gameEnd.title')}</DialogTitle>
          <DialogDescription className="text-2xl font-semibold text-amber-300">{t(title)}</DialogDescription>
        </DialogHeader>
        {mine && (
          <p className="text-lg tabular-nums" data-testid="rating-change">
            {t('ranked.ratingChange', { before: mine.ratingBefore, after: mine.ratingAfter, delta: formatDelta(mine.ratingBefore, mine.ratingAfter) })}
          </p>
        )}
        <DialogFooter className="mt-2 flex-row justify-center">
          <Button autoFocus onClick={() => leave(onAgain)} disabled={!result || leaving}>{t('ranked.again')}</Button>
          <Button variant="outline" onClick={() => leave(onHome)} disabled={leaving}>{t('gameEnd.home')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
