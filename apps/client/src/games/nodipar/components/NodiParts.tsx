import { useEffect, useRef, useState } from 'react';
import { Bot, Crown } from 'lucide-react';
import { toast } from 'sonner';
import type { BoardState, ShotEvent } from '@carrom/engine';
import { NODI_RULES, seatsOf, teamOf, TURNS, type NodiEvent, type NodiView, type Team } from '@hub/nodipar';
import { RewardedAdButton, useGameEndAds } from '@/components/AdParts';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { t } from '@/i18n/t';
import { haptic } from '@/lib/native';
import { playSound } from '@/lib/sound';
import { cn } from '@/lib/utils';
import { seatName, sideLabel } from '../localNodi';
import { seatColor, teamColor } from '../skins';

const MS_PER_S = 1000;
const LOW_S = 5;
const LOUD_SPEED = 1.5;

/** NODI-4 the turn clock (same length as carrom's shot clock). Give it a new `key` each turn. */
export function NodiClock({ running, onExpire, startMs = NODI_RULES.CLOCK_MS }: { running: boolean; onExpire: () => void; startMs?: number }) {
  const [left, setLeft] = useState(Math.min(startMs, NODI_RULES.CLOCK_MS));
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
    // Only `running` restarts the countdown (re-running on each tick would reset `end`).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running]);
  const s = Math.ceil(left / MS_PER_S);
  return <span className={cn('tabular-nums text-sm', s <= LOW_S ? 'font-semibold text-red-400' : 'opacity-80')}>{t('clock.label', { s })}</span>;
}

/** Round wins per side so far. */
export function roundWins(view: Pick<NodiView, 'results'>): Record<Team, number> {
  const wins = { A: 0, B: 0 };
  for (const r of view.results) if (r.winner) wins[r.winner]++;
  return wins;
}

interface StripProps {
  view: NodiView;
  names: readonly string[];
  bots: readonly number[];
  me?: number | null;
}

/** NODI-4 HUD: each side's live points and round wins, each seat's moves left, whose turn it is. */
export function ScoreStrip({ view, names, bots, me = null }: StripProps) {
  const { config } = view;
  const wins = roundWins(view);
  const seats = seatsOf(config);
  return (
    <div className="flex flex-col gap-1" data-testid="nodi-score">
      <p className="text-center text-xs opacity-70">{t('nodi.round', { n: view.round })}</p>
      <div className="grid grid-cols-2 gap-1.5">
        {(['A', 'B'] as const).map((team) => (
          <div key={team} className="flex flex-col gap-0.5 rounded-md border border-border px-2 py-1 text-sm">
            <div className="flex items-center gap-2">
              <span className="size-3 shrink-0 rounded-full" style={{ background: teamColor(team, config.players) }} />
              <span className="font-semibold tabular-nums" data-testid={`live-${team}`}>{t('nodi.points', { n: view.live[team] })}</span>
              <span className="ml-auto text-xs tabular-nums opacity-70">{t('nodi.wins', { n: wins[team] })}</span>
              {view.pars[team].length > 0 && <span className="rounded bg-amber-400/20 px-1 text-xs text-amber-300">{t('nodi.par')}</span>}
            </div>
            {seats.filter((s) => teamOf(config, s) === team).map((s) => {
              const turn = view.winner === null && view.turnSeat === s;
              return (
                <div key={s} className={cn('flex items-center gap-1.5 text-xs', turn && 'font-semibold text-amber-300')} aria-current={turn ? 'true' : undefined}>
                  <span className="size-2 shrink-0 rounded-full" style={{ background: seatColor(s) }} />
                  <span className="min-w-0 flex-1 truncate">{seatName(names, s)}{me === s && ` (${t('lobby.you')})`}</span>
                  {bots.includes(s) && <Bot className="size-3 opacity-70" aria-label={t('nodi.bot')} />}
                  <span className="tabular-nums opacity-70">{t('nodi.movesLeft', { n: TURNS - (view.moves[s] ?? 0) })}</span>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

/** Toasts for what the river doesn't show by itself: round results, pars, whirlpools, timeouts. */
export function announce(view: Pick<NodiView, 'config'>, names: readonly string[], events: readonly NodiEvent[]): void {
  const side = (team: Team) => sideLabel(view.config, names, team);
  for (const e of events) {
    if (e.type === 'par') toast(t('nodi.toast.par', { name: side(e.team) }), { duration: 1800 });
    if (e.type === 'whirlpool') toast(t('nodi.toast.whirlpool', { name: seatName(names, e.seat) }), { duration: 1500 });
    if (e.type === 'roundEnd') {
      const r = e.result;
      toast(r.winner ? t('nodi.toast.round', { n: r.round, name: side(r.winner), a: r.points.A, b: r.points.B }) : t('nodi.toast.roundDraw', { n: r.round, a: r.points.A, b: r.points.B }), { duration: 3000 });
    }
    if (e.type === 'botTakeover') toast(t('toast.botTakeover', { name: seatName(names, e.seat) }));
    if (e.type === 'timeout') toast(t('toast.timeout', { name: seatName(names, e.seat) }), { duration: 1500 });
  }
}

/** UI-7 sounds for one playback frame (shared Web Audio kinds). */
export function shotSounds(events: readonly ShotEvent[], board: BoardState): void {
  for (const e of events) {
    const id = e.type === 'hit' ? e.a : e.id;
    const p = board.pieces.find((q) => q.id === id);
    const speed = p ? Math.sqrt(p.vx * p.vx + p.vy * p.vy) : 0;
    const loud = Math.min(1, 0.25 + speed / LOUD_SPEED);
    if (e.type === 'hit') playSound('hit', loud);
    else if (e.type === 'rock' || e.type === 'frame') playSound('frame', loud);
    else if (e.type === 'pocket') {
      playSound('pocket');
      haptic('pocket');
    }
  }
}

interface EndProps {
  view: NodiView;
  names: readonly string[];
  onRematch: () => void;
  onHome: () => void;
  note?: string;
  rematchDisabled?: boolean;
}

const stay = (e: Event) => e.preventDefault();

/** NODI-4 match end: winner, the rounds, rematch or home. AD-3 rewarded offer; AD-4 interstitial on the way out. */
export function NodiEndDialog({ view, names, onRematch, onHome, note, rematchDisabled = false }: EndProps) {
  const { leaving, leave } = useGameEndAds();
  const winner = view.winner ? sideLabel(view.config, names, view.winner) : '';
  return (
    <Dialog open>
      <DialogContent className="p-6 text-center" onEscapeKeyDown={stay} onPointerDownOutside={stay}>
        <DialogHeader>
          <DialogTitle className="text-xl">{t('gameEnd.title')}</DialogTitle>
          <DialogDescription className="flex items-center justify-center gap-2 text-2xl font-semibold text-amber-300">
            <Crown className="size-6" />{t('gameEnd.winner', { name: winner })}
          </DialogDescription>
        </DialogHeader>
        <ol className="flex flex-col gap-1 text-sm tabular-nums" data-testid="nodi-rounds">
          {view.results.map((r) => (
            <li key={r.round}>{t('nodi.roundLine', { n: r.round, a: r.points.A, b: r.points.B })}</li>
          ))}
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
