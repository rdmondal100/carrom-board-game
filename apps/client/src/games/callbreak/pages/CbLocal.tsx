import { useCallback, useEffect, useRef, useState } from 'react';
import { Navigate, useNavigate } from 'react-router';
import { toast } from 'sonner';
import { callbreakView, type CallbreakEvent, type CallbreakMove } from '@hub/callbreak';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { CbClock, CbEndDialog, ScoreDialog } from '@/games/callbreak/components/CbParts';
import { ViewToggle } from '@/components/ViewToggle';
import { CbPlayArea } from '@/games/callbreak/components/CbPlayArea';
import {
  botMove, botTurn, clockRuns, ME, moveLocal, myView, newSeed, rematchLocal, takeBack, timeoutLocal, vsBotResult,
  type LocalCallbreak, type Step,
} from '@/games/callbreak/localCallbreak';
import { cbPath } from '@/games/callbreak/paths';
import { clearCallbreakSave, loadCallbreak, saveCallbreak } from '@/games/callbreak/save';
import { cbLook } from '@/games/callbreak/skins';
import { useFrames } from '@/games/callbreak/useFrames';
import { t, useLang } from '@/i18n/t';
import { onPauseRequest } from '@/lib/backButton';
import { playSound } from '@/lib/sound';
import { claimBotReward } from '@/store/shopSlice';
import { rewardToast } from '@/lib/rewardToast';
import { useAppDispatch, useAppSelector } from '@/store/store';

const BOT_THINK_MS = 600;

/** Toasts for redeals and takeovers (calls and cards show on the table). */
export function announce(names: readonly string[], events: readonly CallbreakEvent[]): void {
  for (const e of events) {
    if (e.type === 'deal' && e.redeals > 0) toast(t('callbreak.redealt', { n: e.redeals }), { duration: 1500 });
    if (e.type === 'timeout') toast(t('toast.timeout', { name: names[e.seat] ?? '' }), { duration: 1500 });
    if (e.type === 'botTakeover') toast(t('toast.botTakeover', { name: names[e.seat] ?? '' }));
  }
}

/** Status under the table: whose call or card it is. */
export function statusLine(view: { phase: string; turnSeat: number; winner: string | null }, names: readonly string[], mine: boolean, busy: boolean, bot: boolean): string {
  if (view.winner !== null) return '';
  if (busy) return t('callbreak.playing');
  const name = names[view.turnSeat] ?? '';
  if (view.phase === 'bid') return mine ? '' : t('callbreak.waitBid', { name });
  if (mine) return t('callbreak.yourPlay');
  return bot ? t('online.botTurn', { name }) : t('callbreak.waitPlay', { name });
}

/** CB-7 play the saved vs-bot game; without one, go to setup. */
export function CbLocal() {
  const [initial] = useState(loadCallbreak);
  if (!initial) return <Navigate to={cbPath('local/setup')} replace />;
  return <Play initial={initial} />;
}

function Play({ initial }: { initial: LocalCallbreak }) {
  useLang();
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const signedIn = useAppSelector((s) => s.auth.user !== null);
  const look = cbLook(useAppSelector((s) => s.auth.user?.cosmetics.equipped.callbreak));
  const [game, setGame] = useState(initial);
  const [leaving, setLeaving] = useState(false);
  const [sheet, setSheet] = useState(false);
  const { frame, busy, play } = useFrames();
  const { state } = game;
  const view = myView(game);

  const apply = useCallback((from: LocalCallbreak, step: Step | null) => {
    if (!step) return;
    setGame(step.game);
    saveCallbreak(step.game);
    announce(step.game.names, step.events);
    play(myView(from), step.events, myView(step.game));
  }, [play]);

  // The first deal of a fresh game, once.
  const opened = useRef(false);
  useEffect(() => {
    if (opened.current) return;
    opened.current = true;
    if (initial.state.turnId === 0) play(myView(initial), initial.state.recent, myView(initial));
  }, [initial, play]);

  // Bots (and your seat after a takeover) move after a short think.
  useEffect(() => {
    if (busy || botTurn(game) === null) return;
    const id = setTimeout(() => apply(game, botMove(game, newSeed())), BOT_THINK_MS);
    return () => clearTimeout(id);
  }, [apply, busy, game]);

  useEffect(() => { if (!busy && state.turnSeat === ME && state.winner === null) playSound('turn'); }, [busy, state.turnSeat, state.winner]);
  useEffect(() => onPauseRequest(() => setLeaving(true)), []);

  // COS-2: a finished vs-bot game earns coins (the server caps it per day).
  const rewarded = useRef<LocalCallbreak | null>(null);
  useEffect(() => {
    if (state.winner === null || busy || !signedIn || rewarded.current === game) return;
    rewarded.current = game;
    const won = vsBotResult(game);
    if (won === null) return;
    dispatch(claimBotReward({ won, game: 'callbreak' })).unwrap()
      .then(rewardToast)
      .catch(() => { /* offline: no reward */ });
  }, [busy, dispatch, game, signedIn, state.winner]);

  const mine = botTurn(game) === null && state.winner === null && !busy;
  const move = (m: CallbreakMove) => { if (mine) apply(game, moveLocal(game, m)); };
  const bots = [1, 2, 3, ...(game.takeover ? [ME] : [])];

  return (
    <div className="mx-auto flex w-full max-w-xl min-h-0 flex-1 flex-col gap-2">
      <div className="flex items-center gap-2">
        <span className="flex-1 text-sm font-medium">{t('callbreak.round', { n: state.round, total: state.config.rounds })}</span>
        <Button size="sm" variant="outline" onClick={() => setSheet(true)}>{t('callbreak.scores')}</Button>
        <ViewToggle game="callbreak" />
        <Button size="sm" variant="ghost" onClick={() => setLeaving(true)}>{t('pause.title')}</Button>
      </div>
      <CbPlayArea view={view} frame={frame} me={ME} names={game.names} bots={bots} canAct={mine} look={look}
        onBid={(bid) => move({ bid })} onPlay={(card) => move({ card })}>
        <p className="rounded-full bg-white/10 px-3 py-1 text-sm font-semibold empty:hidden" role="status">{statusLine(state, game.names, state.turnSeat === ME && !game.takeover, busy, botTurn(game) !== null)}</p>
        {clockRuns(game) && !busy && <CbClock key={state.turnId} running={!leaving} onExpire={() => apply(game, timeoutLocal(game))} />}
        {game.takeover && (
          <Button size="sm" variant="outline" onClick={() => { const g = takeBack(game); setGame(g); saveCallbreak(g); }}>{t('online.takeBack')}</Button>
        )}
      </CbPlayArea>
      <ScoreDialog open={sheet} onClose={() => setSheet(false)} scores={state.scores} names={game.names} />
      {leaving && (
        <Dialog open onOpenChange={(o) => { if (!o) setLeaving(false); }}>
          <DialogContent className="p-6">
            <DialogHeader><DialogTitle>{t('pause.title')}</DialogTitle></DialogHeader>
            <DialogFooter className="flex-row justify-end gap-2">
              <Button variant="outline" onClick={() => setLeaving(false)}>{t('pause.resume')}</Button>
              <Button variant="destructive" onClick={() => navigate('/')}>{t('callbreak.saveQuit')}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
      {!busy && state.winner !== null && (
        <CbEndDialog winner={game.names[Number(state.winner)] ?? ''} scores={state.scores} names={game.names}
          onRematch={() => { const g = rematchLocal(game); setGame(g); saveCallbreak(g); play(callbreakView(g.state, ME), g.state.recent, callbreakView(g.state, ME)); }}
          onHome={() => { clearCallbreakSave(); navigate('/'); }} />
      )}
    </div>
  );
}
