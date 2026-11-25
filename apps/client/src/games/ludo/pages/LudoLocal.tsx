import { useCallback, useEffect, useRef, useState } from 'react';
import { Navigate, useNavigate } from 'react-router';
import { toast } from 'sonner';
import { legalTokens, ludoResult, seatsOf, type LudoEvent, type LudoMove } from '@hub/ludo';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Dice } from '@/games/ludo/components/Dice';
import { DiceDock } from '@/games/ludo/components/DiceDock';
import { LudoBoard } from '@/games/ludo/components/LudoBoard';
import { LudoClock, LudoEndDialog, PlayerStrip, standingsOf } from '@/games/ludo/components/LudoParts';
import {
  botMove, botTurn, clockRuns, humanSeats, moveLocal, newSeed, rematchLocal, seatName, takeBack, timeoutLocal, vsBotResult,
  winnerLabel, type LocalLudo, type Step,
} from '@/games/ludo/localLudo';
import { ludoPath } from '@/games/ludo/paths';
import { clearLudoSave, loadLudo, saveLudo } from '@/games/ludo/save';
import { ludoLook } from '@/games/ludo/skins';
import { usePlayback } from '@/games/ludo/usePlayback';
import { t, useLang } from '@/i18n/t';
import { onPauseRequest } from '@/lib/backButton';
import { playSound } from '@/lib/sound';
import { claimBotReward } from '@/store/shopSlice';
import { useAppDispatch, useAppSelector } from '@/store/store';

const BOT_THINK_MS = 500;

/** Toasts for passes and takeovers (moves and captures are on the board). */
export function announce(names: readonly string[], events: readonly LudoEvent[]): void {
  for (const e of events) {
    if (e.type === 'pass') toast(t(`ludo.pass.${e.reason}`, { name: seatName(names, e.seat) }), { duration: 1500 });
    if (e.type === 'botTakeover') toast(t('toast.botTakeover', { name: seatName(names, e.seat) }));
    if (e.type === 'timeout') toast(t('toast.timeout', { name: seatName(names, e.seat) }), { duration: 1500 });
  }
}

/** LUDO-6 play the saved same-device game; without one, go to setup. */
export function LudoLocal() {
  const [initial] = useState(loadLudo);
  if (!initial) return <Navigate to={ludoPath('local/setup')} replace />;
  return <Play initial={initial} />;
}

function Play({ initial }: { initial: LocalLudo }) {
  useLang();
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const signedIn = useAppSelector((s) => s.auth.user !== null);
  const look = ludoLook(useAppSelector((s) => s.auth.user?.cosmetics.equipped.ludo));
  const [game, setGame] = useState(initial);
  const [leaving, setLeaving] = useState(false);
  const { frame, busy, play } = usePlayback();
  const thinking = useRef(false);
  const { state } = game;
  const seats = seatsOf(state.config);
  const [viewSeat] = useState(() => humanSeats(initial)[0] ?? seats[0]!);

  /** Show a step's events from the tokens on screen, then keep its game. */
  const apply = useCallback((from: LocalLudo, step: Step | null) => {
    if (!step) return;
    setGame(step.game);
    saveLudo(step.game);
    announce(step.game.names, step.events);
    play(from.state.tokens, step.events);
  }, [play]);

  // The opening rolls of a fresh game, once.
  const opened = useRef(false);
  useEffect(() => {
    if (opened.current) return;
    opened.current = true;
    if (initial.state.turnId === 0) play(initial.state.tokens.map((l) => l.map(() => -1)), initial.state.recent);
  }, [initial, play]);

  // BOT-6 style: bots (and taken-over seats) move after a short think.
  useEffect(() => {
    if (busy || state.winner !== null || botTurn(game) === null || thinking.current) return;
    thinking.current = true;
    const id = setTimeout(() => {
      thinking.current = false;
      apply(game, botMove(game, newSeed()));
    }, BOT_THINK_MS);
    return () => { clearTimeout(id); thinking.current = false; };
  }, [apply, busy, game, state.winner]);

  useEffect(() => { if (!busy && state.winner === null) playSound('turn'); }, [busy, state.turnSeat, state.winner]);
  useEffect(() => onPauseRequest(() => setLeaving(true)), []);

  // COS-2: a finished vs-bot game earns coins (the server caps it per day).
  const rewarded = useRef<LocalLudo | null>(null);
  useEffect(() => {
    if (state.winner === null || busy || !signedIn || rewarded.current === game) return;
    rewarded.current = game;
    const won = vsBotResult(game);
    if (won === null) return;
    dispatch(claimBotReward(won)).unwrap()
      .then((coins) => { if (coins > 0) toast.success(t('reward.toast', { coins })); })
      .catch(() => { /* offline: no reward */ });
  }, [busy, dispatch, game, signedIn, state.winner]);

  const human = botTurn(game) === null && state.winner === null && !busy;
  const move = (m: LudoMove) => { if (human) apply(game, moveLocal(game, m)); };
  const legal = human && state.phase === 'move' && state.dice !== null ? legalTokens(state, state.turnSeat, state.dice) : [];
  const shownDice = frame?.dice ?? (state.dice !== null ? { seat: state.turnSeat, value: state.dice } : null);
  const result = !busy ? ludoResult(state) : null;
  const me = state.turnSeat;

  return (
    <div className="mx-auto flex w-full max-w-xl min-h-0 flex-1 flex-col gap-2">
      <div className="flex items-center gap-2">
        <div className="flex-1"><PlayerStrip view={state} seats={seats} names={game.names} bots={seats.filter((s) => game.takeover.includes(s) || game.players[s] !== 'human')} /></div>
        <Button size="sm" variant="ghost" onClick={() => setLeaving(true)}>{t('pause.title')}</Button>
      </div>
      <DiceDock seat={busy && frame?.dice ? frame.dice.seat : state.turnSeat} viewSeat={viewSeat} face={humanSeats(game).length >= 2}
        board={(
          <LudoBoard seats={seats} tokens={frame?.tokens ?? state.tokens} board={look.board} tokenSkinOf={() => look.tokens}
            viewSeat={viewSeat} turnSeat={state.turnSeat} legal={legal} onPick={(token) => move({ token })} label={t('ludo.board')} />
        )}
        die={(
          <>
            <Dice value={shownDice?.value ?? null} skin={look.dice} rolling={frame?.cue === 'roll'} label={t('ludo.dice', { n: shownDice?.value ?? '?' })}
              onRoll={human && state.phase === 'roll' ? () => move({ roll: true }) : undefined} />
            <p className="max-w-36 truncate rounded-full bg-white/10 px-3 py-1 text-xs font-semibold empty:hidden" role="status">
              {state.winner !== null ? '' : busy ? t('ludo.moving')
                : botTurn(game) ? t('online.botTurn', { name: seatName(game.names, me) })
                  : state.phase === 'roll' ? t('ludo.tapRoll', { name: seatName(game.names, me) }) : t('ludo.pick', { name: seatName(game.names, me) })}
            </p>
          </>
        )}
        extra={(
          <>
            {clockRuns(game) && !busy && (
              <LudoClock key={`${state.turnId}`} running={!leaving} onExpire={() => apply(game, timeoutLocal(game))} />
            )}
            {game.takeover.length > 0 && game.takeover.map((s) => (
              <Button key={s} size="sm" variant="outline" onClick={() => { const g = takeBack(game, s); setGame(g); saveLudo(g); }}>
                {t('ludo.takeBack', { name: seatName(game.names, s) })}
              </Button>
            ))}
          </>
        )} />
      {leaving && (
        <Dialog open onOpenChange={(o) => { if (!o) setLeaving(false); }}>
          <DialogContent className="p-6">
            <DialogHeader><DialogTitle>{t('pause.title')}</DialogTitle></DialogHeader>
            <DialogFooter className="flex-row justify-end gap-2">
              <Button variant="outline" onClick={() => setLeaving(false)}>{t('pause.resume')}</Button>
              <Button variant="destructive" onClick={() => navigate('/')}>{t('ludo.saveQuit')}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
      {result && state.winner !== null && (
        <LudoEndDialog
          winner={winnerLabel(state.config, game.names, state.winner)}
          standings={standingsOf(result.placings, seats, game.names)}
          onRematch={() => { const g = rematchLocal(game); setGame(g); saveLudo(g); play(g.state.tokens, g.state.recent); }}
          onHome={() => { clearLudoSave(); navigate('/'); }}
        />
      )}
    </div>
  );
}
