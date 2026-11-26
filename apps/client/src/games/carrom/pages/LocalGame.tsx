import { carromPath } from '../paths';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Navigate, useNavigate } from 'react-router';
import { toast } from 'sonner';
import type { BoardState, ShotEvent, ShotInput } from '@carrom/engine';
import type { RuleEvent, Team } from '@carrom/rules';
import { BoardEndDialog } from '@/games/carrom/components/BoardEndDialog';
import { GameEndScreen } from '@/games/carrom/components/GameEndScreen';
import { Hud } from '@/games/carrom/components/Hud';
import { PauseMenu } from '@/games/carrom/components/PauseMenu';
import { ShotClock } from '@/games/carrom/components/ShotClock';
import { Button } from '@/components/ui/button';
import { requestBotShot } from '@/games/carrom/botClient';
import { soundsForEvents } from '@/games/carrom/eventSounds';
import { coinKey, reasonKey } from '@/games/carrom/hud';
import {
  botLevelAt, humanSeats, newSeed, seatName, shooterSeat, shootLocal, startLocal, takeBack, timeoutLocal,
  viewSeatFor, vsBotResult,
  type LocalGame as Game,
} from '@/games/carrom/localGame';
import { clearSave, loadGame, saveGame } from '@/games/carrom/save';
import { localSkins } from '@/games/carrom/skins';
import { useBoardCanvas } from '@/games/carrom/useBoardCanvas';
import { t, useLang } from '@/i18n/t';
import { onPauseRequest } from '@/lib/backButton';
import { haptic } from '@/lib/native';
import { playSound } from '@/lib/sound';
import { claimBotReward } from '@/store/shopSlice';
import { useAppDispatch, useAppSelector } from '@/store/store';
import { useGameView } from '@/game3d/useGameView';

type BoardEnd = { next: Game; boardNo: number; winner: Team; points: number };

/** UI-7 / APP-7: one frame's events → sounds (and a haptic tap on a pocket). */
function playEvents(events: ShotEvent[], board: BoardState): void {
  for (const cue of soundsForEvents(events, board)) {
    playSound(cue.kind, cue.strength);
    if (cue.kind === 'pocket') haptic('pocket');
  }
}

/** LOC-9: play the saved game; without one, go to setup. */
export function LocalGame() {
  const [initial] = useState(loadGame);
  if (!initial) return <Navigate to={carromPath('local/setup')} replace />;
  return <Play initial={initial} />;
}

function Play({ initial }: { initial: Game }) {
  useLang();
  const navigate = useNavigate();
  const rotate = useAppSelector((s) => s.settings.viewRotation);
  const dispatch = useAppDispatch();
  const signedIn = useAppSelector((s) => s.auth.user !== null);
  const equipped = useAppSelector((s) => s.auth.user?.cosmetics.equipped.carrom);
  const host = useRef<HTMLDivElement>(null);
  const [game, setGame] = useState(initial);
  const [initialSeat] = useState(() => viewSeatFor(initial, rotate, humanSeats(initial)[0] ?? shooterSeat(initial)));
  const viewRef = useRef(initialSeat);
  const [turnNo, setTurnNo] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [placedOk, setPlacedOk] = useState(true);
  const [paused, setPaused] = useState(false);
  const [boardEnd, setBoardEnd] = useState<BoardEnd | null>(null);
  const [gameEnd, setGameEnd] = useState<Team | null>(null);
  const pending = useRef<{ game: Game; ruleEvents: RuleEvent[] } | null>(null);
  const lastSeat = useRef(initial.state.turnSeat);

  /** LOC-4 toasts for returned coins and skipped turns. */
  const announce = useCallback((g: Game, events: RuleEvent[]) => {
    for (const e of events) {
      if (e.type === 'returned') toast(t('toast.returned', { coin: t(coinKey(e.id)), reason: t(reasonKey(e.reason)) }));
      if (e.type === 'botTakeover') toast(t('toast.botTakeover', { name: seatName(g, e.seat) }));
    }
  }, []);

  // UI-7: a chime whenever the turn moves to another seat.
  useEffect(() => {
    if (game.state.turnSeat !== lastSeat.current) playSound('turn');
    lastSeat.current = game.state.turnSeat;
  }, [game.state.turnSeat]);

  /** LOC-6: the turn changes only once the animation is over. */
  const finishShot = () => {
    const p = pending.current;
    pending.current = null;
    if (!p) return;
    announce(p.game, p.ruleEvents);
    const end = p.ruleEvents.find((e) => e.type === 'gameEnd');
    const board = p.ruleEvents.find((e) => e.type === 'boardEnd');
    if (end) {
      clearSave();
      setGame(p.game);
      setGameEnd(end.winner);
    } else if (board) {
      saveGame(p.game);
      setBoardEnd({ next: p.game, boardNo: game.state.boardNo, winner: board.winner, points: board.points });
    } else {
      saveGame(p.game);
      setGame(p.game);
      setTurnNo((n) => n + 1);
    }
  };

  const gfx = useGameView('carrom');
  const board = useBoardCanvas(host, initialSeat, {
    onShot: (input: ShotInput) => {
      haptic('strike');
      const out = shootLocal(game, input);
      pending.current = { game: out.game, ruleEvents: out.ruleEvents };
    },
    onEvents: playEvents,
    onPlayingChange: (p) => {
      setPlaying(p);
      if (!p) finishShot();
    },
    onPlacedChange: setPlacedOk,
    onFail: gfx.failed,
  }, 'contain', gfx.view);

  // LOC-3: show the current board from a person's seat; Vs bot it never turns.
  useEffect(() => {
    const view = viewSeatFor(game, rotate, viewRef.current);
    viewRef.current = view;
    board.current.load(game.state.board, shooterSeat(game), view);
  }, [board, game, rotate]);

  // COS-6: this player's own skins on every seat.
  useEffect(() => { board.current.setSkins(localSkins(equipped)); }, [board, equipped]);

  // COS-2: a finished Vs-bot game earns coins (the server caps it per day); same-device games don't.
  const rewarded = useRef<Game | null>(null);
  useEffect(() => {
    if (gameEnd === null || !signedIn || rewarded.current === game) return;
    rewarded.current = game;
    const won = vsBotResult(game, gameEnd);
    if (won === null) return;
    dispatch(claimBotReward(won)).unwrap()
      .then((coins) => { if (coins > 0) toast.success(t('reward.toast', { coins })); })
      .catch(() => { /* offline: no reward */ });
  }, [dispatch, game, gameEnd, signedIn]);

  // APP-3: hardware back opens the pause menu (not while a shot plays, like the HUD button).
  useEffect(() => onPauseRequest(() => { if (!playing) setPaused(true); }), [playing]);

  const overlay = paused || boardEnd !== null || gameEnd !== null;
  const botLevel = game.state.winner === null ? botLevelAt(game, game.state.turnSeat) : null;
  const botTurn = botLevel !== null;
  useEffect(() => { board.current.setLocked(overlay || botTurn); }, [board, overlay, botTurn]);
  useEffect(() => { if (!game.clockOn || botTurn) board.current.setClock(null); }, [board, game.clockOn, botTurn]);

  // BOT-6 / BOT-7: on a bot's turn, search in the worker, then show and play the shot.
  // Pausing, a new game or "take back control" drops a search still running.
  useEffect(() => {
    if (botLevel === null || playing || overlay) return;
    const api = board.current;
    let live = true;
    requestBotShot(game.state, botLevel, newSeed())
      .then((input) => { if (live) api.playBot(input); })
      .catch((err: unknown) => console.error('bot failed', err));
    return () => {
      live = false;
      api.cancelBot();
    };
  }, [board, game, botLevel, playing, overlay]);

  /** BOT-7: the person at `seat` plays again. */
  const reclaim = (seat: number) => {
    const next = takeBack(game, seat);
    saveGame(next);
    setGame(next);
  };

  const onExpire = () => {
    if (playing || overlay) return;
    const out = timeoutLocal(game);
    toast(t('toast.timeout', { name: seatName(game, game.state.turnSeat) }));
    announce(out.game, out.ruleEvents);
    saveGame(out.game);
    setGame(out.game);
    setTurnNo((n) => n + 1);
  };

  const restart = () => {
    const fresh = startLocal({ ...game.state.config, seed: newSeed() }, game.names, game.clockOn, game.players);
    saveGame(fresh);
    setGame(fresh);
    setBoardEnd(null);
    setGameEnd(null);
    setPaused(false);
    setTurnNo((n) => n + 1);
  };
  const quit = () => {
    clearSave();
    navigate('/');
  };
  const nextBoard = () => {
    if (!boardEnd) return;
    setGame(boardEnd.next);
    setBoardEnd(null);
    setTurnNo((n) => n + 1);
  };

  const clock = game.clockOn && !botTurn ? (
    <ShotClock
      key={turnNo}
      running={!playing && !overlay}
      onTick={(f) => board.current.setClock(f)}
      onExpire={onExpire}
    />
  ) : null;

  // UI-5: HUD and hint take what they need; the board gets the rest of the height.
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2">
      <Hud game={game} clock={clock} onPause={() => setPaused(true)} canPause={!playing} />
      <div ref={host} data-testid="board-host" className="flex min-h-0 flex-1 items-center justify-center overflow-hidden select-none" />
      <p className="min-h-5 text-center text-sm text-muted-foreground">
        {playing ? t('hud.playing')
          : botTurn ? t('hud.botThinking', { name: seatName(game, game.state.turnSeat) })
            : placedOk ? t('hud.hint') : t('hud.blocked')}
      </p>
      {game.takeover.length > 0 && (
        <div className="flex flex-wrap justify-center gap-2">
          {game.takeover.map((seat) => (
            <Button key={seat} size="sm" variant="outline" onClick={() => reclaim(seat)}>
              {t('game.takeBack', { name: seatName(game, seat) })}
            </Button>
          ))}
        </div>
      )}
      {paused && <PauseMenu onResume={() => setPaused(false)} onRestart={restart} onQuit={quit} />}
      {boardEnd && (
        <BoardEndDialog game={boardEnd.next} boardNo={boardEnd.boardNo} winner={boardEnd.winner} points={boardEnd.points} onNext={nextBoard} />
      )}
      {gameEnd && <GameEndScreen game={game} winner={gameEnd} onRematch={restart} onHome={quit} />}
    </div>
  );
}
