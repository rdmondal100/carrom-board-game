import { useCallback, useEffect, useRef, useState } from 'react';
import { Navigate, useNavigate } from 'react-router';
import { toast } from 'sonner';
import type { Seat } from '@carrom/engine';
import { seatsOf, type NodiMove } from '@hub/nodipar';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { announce, NodiClock, NodiEndDialog, ScoreStrip, shotSounds } from '@/games/nodipar/components/NodiParts';
import { ViewToggle } from '@/components/ViewToggle';
import { RiverBoard } from '@/games/nodipar/components/RiverBoard';
import {
  botMove, botTurn, clockRuns, humanSeats, moveLocal, newSeed, rematchLocal, seatName, takeBack, timeoutLocal, vsBotResult,
  type LocalNodi, type Step,
} from '@/games/nodipar/localNodi';
import { nodiPath } from '@/games/nodipar/paths';
import { clearNodiSave, loadNodi, saveNodi } from '@/games/nodipar/save';
import { nodiLook } from '@/games/nodipar/skins';
import type { RiverApi } from '@/games/nodipar/useRiverCanvas';
import { t, useLang } from '@/i18n/t';
import { onPauseRequest } from '@/lib/backButton';
import { playSound } from '@/lib/sound';
import { claimBotReward } from '@/store/shopSlice';
import { rewardToast } from '@/lib/rewardToast';
import { useAppDispatch, useAppSelector } from '@/store/store';

const BOT_THINK_MS = 500;

/** NODI-5 play the saved same-device / vs-bot game; without one, go to setup. */
export function NodiLocal() {
  const [initial] = useState(loadNodi);
  if (!initial) return <Navigate to={nodiPath('local/setup')} replace />;
  return <Play initial={initial} />;
}

/** Hot seat: the person on turn sits at the bottom; vs bot: the (first) person always does. */
function viewFor(g: LocalNodi): Seat {
  const people = humanSeats(g);
  const turn = g.state.turnSeat;
  return (people.includes(turn) && people.length > 1 ? turn : people[0] ?? seatsOf(g.state.config)[0]!) as Seat;
}

function Play({ initial }: { initial: LocalNodi }) {
  useLang();
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const signedIn = useAppSelector((s) => s.auth.user !== null);
  const look = nodiLook(useAppSelector((s) => s.auth.user?.cosmetics.equipped.nodipar));
  const river = useRef<RiverApi>(null);
  const [game, setGame] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const thinking = useRef(false);
  const { state } = game;

  useEffect(() => {
    river.current?.setLook(() => look.boat, look.river);
  }, [look.boat, look.river]);
  useEffect(() => {
    if (!busy) river.current?.show(game.state, viewFor(game));
  }, [busy, game]);
  useEffect(() => {
    river.current?.setCanMove(!busy && botTurn(game) === null && state.winner === null && !leaving);
  }, [busy, game, leaving, state.winner]);

  /** Play a step from the river on screen, then keep its game. */
  const apply = useCallback((step: Step | null, preview: boolean) => {
    if (!step) return;
    saveNodi(step.game);
    const done = () => {
      setGame(step.game);
      setBusy(false);
      announce(step.game.state, step.game.names, step.events);
    };
    setBusy(true);
    if (step.move && river.current) river.current.play(step.seat, step.move, preview, done);
    else done();
  }, []);

  // Bots (and taken-over seats) move after a short think.
  useEffect(() => {
    if (busy || state.winner !== null || botTurn(game) === null || thinking.current) return;
    thinking.current = true;
    const id = setTimeout(() => {
      thinking.current = false;
      apply(botMove(game, newSeed()), true);
    }, BOT_THINK_MS);
    return () => { clearTimeout(id); thinking.current = false; };
  }, [apply, busy, game, state.winner]);

  useEffect(() => { if (!busy && state.winner === null) playSound('turn'); }, [busy, state.turnSeat, state.winner]);
  useEffect(() => onPauseRequest(() => setLeaving(true)), []);

  // COS-2: a finished vs-bot game earns coins (the server caps it per day).
  const rewarded = useRef<LocalNodi | null>(null);
  useEffect(() => {
    if (state.winner === null || busy || !signedIn || rewarded.current === game) return;
    rewarded.current = game;
    const won = vsBotResult(game);
    if (won === null) return;
    dispatch(claimBotReward({ won, game: 'nodipar' })).unwrap()
      .then(rewardToast)
      .catch(() => { /* offline: no reward */ });
  }, [busy, dispatch, game, signedIn, state.winner]);

  const onMove = (m: NodiMove) => {
    if (busy || botTurn(game) !== null) return;
    const step = moveLocal(game, m);
    if (!step) { toast(t('nodi.blocked')); return; }
    apply(step, false);
  };
  const bot = botTurn(game);
  const me = state.turnSeat;

  return (
    <div className="mx-auto flex w-full max-w-xl min-h-0 flex-1 flex-col gap-2">
      <div className="flex items-start gap-2">
        <div className="flex-1"><ScoreStrip view={state} names={game.names} bots={seatsOf(state.config).filter((s) => game.takeover.includes(s) || game.players[s] !== 'human')} /></div>
        <ViewToggle game="nodipar" />
        <Button size="sm" variant="ghost" onClick={() => setLeaving(true)}>{t('pause.title')}</Button>
      </div>
      <RiverBoard ref={river} label={t('nodi.board')} className="self-center" onMove={onMove} onEvents={shotSounds} />
      <div className="flex flex-wrap items-center justify-center gap-3">
        <p className="text-sm" role="status">
          {state.winner !== null ? '' : busy ? t('nodi.moving') : bot ? t('online.botTurn', { name: seatName(game.names, me) }) : t('nodi.yourMove', { name: seatName(game.names, me) })}
        </p>
        {clockRuns(game) && !busy && (
          <NodiClock key={`${state.turnId}`} running={!leaving} onExpire={() => apply(timeoutLocal(game), false)} />
        )}
        {game.takeover.map((s) => (
          <Button key={s} size="sm" variant="outline" onClick={() => { const g = takeBack(game, s); setGame(g); saveNodi(g); }}>
            {t('nodi.takeBack', { name: seatName(game.names, s) })}
          </Button>
        ))}
      </div>
      {leaving && (
        <Dialog open onOpenChange={(o) => { if (!o) setLeaving(false); }}>
          <DialogContent className="p-6">
            <DialogHeader><DialogTitle>{t('pause.title')}</DialogTitle></DialogHeader>
            <DialogFooter className="flex-row justify-end gap-2">
              <Button variant="outline" onClick={() => setLeaving(false)}>{t('pause.resume')}</Button>
              <Button variant="destructive" onClick={() => navigate('/')}>{t('nodi.saveQuit')}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
      {!busy && state.winner !== null && (
        <NodiEndDialog view={state} names={game.names}
          onRematch={() => { const g = rematchLocal(game); setGame(g); saveNodi(g); }}
          onHome={() => { clearNodiSave(); navigate('/'); }} />
      )}
    </div>
  );
}
