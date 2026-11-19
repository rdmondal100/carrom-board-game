import { useCallback, useEffect, useRef, useState } from 'react';
import { Navigate, useNavigate } from 'react-router';
import type { ShotInput } from '@carrom/engine';
import type { RuleEvent, Team } from '@carrom/rules';
import { BoardEndDialog } from '@/components/BoardEndDialog';
import { GameEndScreen } from '@/components/GameEndScreen';
import { Hud } from '@/components/Hud';
import { PauseMenu } from '@/components/PauseMenu';
import { ShotClock } from '@/components/ShotClock';
import { Toast, type ToastItem } from '@/components/Toast';
import { ROTATE_KEY } from '@/constants/view';
import { coinKey, reasonKey } from '@/game/hud';
import {
  newSeed, seatName, shooterSeat, shootLocal, startLocal, timeoutLocal, type LocalGame as Game,
} from '@/game/localGame';
import { clearSave, loadGame, saveGame } from '@/game/save';
import { useBoardCanvas } from '@/game/useBoardCanvas';
import { t, useLang } from '@/i18n/t';

function readRotate(): boolean {
  try {
    return localStorage.getItem(ROTATE_KEY) !== 'off';
  } catch {
    return true;
  }
}
function writeRotate(on: boolean): void {
  try {
    localStorage.setItem(ROTATE_KEY, on ? 'on' : 'off');
  } catch {
    // Setting lasts this session only.
  }
}

type BoardEnd = { next: Game; boardNo: number; winner: Team; points: number };

let toastId = 0;

/** LOC-9: play the saved game; without one, go to setup. */
export function LocalGame() {
  const [initial] = useState(loadGame);
  if (!initial) return <Navigate to="/local/setup" replace />;
  return <Play initial={initial} />;
}

function Play({ initial }: { initial: Game }) {
  useLang();
  const navigate = useNavigate();
  const host = useRef<HTMLDivElement>(null);
  const [game, setGame] = useState(initial);
  const [initialSeat] = useState(() => shooterSeat(initial));
  const [turnNo, setTurnNo] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [placedOk, setPlacedOk] = useState(true);
  const [paused, setPaused] = useState(false);
  const [rotate, setRotate] = useState(readRotate);
  const [boardEnd, setBoardEnd] = useState<BoardEnd | null>(null);
  const [gameEnd, setGameEnd] = useState<Team | null>(null);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const pending = useRef<{ game: Game; ruleEvents: RuleEvent[] } | null>(null);

  const toast = useCallback((text: string) => {
    toastId += 1;
    setToasts((old) => [...old, { id: toastId, text }]);
  }, []);
  const dropToast = useCallback((id: number) => setToasts((old) => old.filter((x) => x.id !== id)), []);

  /** LOC-4 toasts for returned coins and skipped turns. */
  const announce = (g: Game, events: RuleEvent[]) => {
    for (const e of events) {
      if (e.type === 'returned') toast(t('toast.returned', { coin: t(coinKey(e.id)), reason: t(reasonKey(e.reason)) }));
      if (e.type === 'botTakeover') toast(t('toast.turnSkipped', { name: seatName(g, e.seat) }));
    }
  };

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

  const board = useBoardCanvas(host, initialSeat, {
    onShot: (input: ShotInput) => {
      const out = shootLocal(game, input);
      pending.current = { game: out.game, ruleEvents: out.ruleEvents };
    },
    onPlayingChange: (p) => {
      setPlaying(p);
      if (!p) finishShot();
    },
    onPlacedChange: setPlacedOk,
  });

  // LOC-3: show the current board, turned to the shooter unless rotation is off.
  useEffect(() => {
    board.current.load(game.state.board, shooterSeat(game), rotate ? shooterSeat(game) : 0);
  }, [board, game, rotate]);

  const overlay = paused || boardEnd !== null || gameEnd !== null;
  useEffect(() => { board.current.setLocked(overlay); }, [board, overlay]);
  useEffect(() => { if (!game.clockOn) board.current.setClock(null); }, [board, game.clockOn]);

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
    const fresh = startLocal({ ...game.state.config, seed: newSeed() }, game.names, game.clockOn);
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
  const changeRotate = (on: boolean) => {
    writeRotate(on);
    setRotate(on);
  };

  const clock = game.clockOn ? (
    <ShotClock
      key={turnNo}
      running={!playing && !overlay}
      onTick={(f) => board.current.setClock(f)}
      onExpire={onExpire}
    />
  ) : null;

  return (
    <div className="flex flex-col gap-3">
      <Hud game={game} clock={clock} onPause={() => setPaused(true)} canPause={!playing} />
      <div ref={host} className="w-full flex justify-center select-none" />
      <p className="text-sm opacity-80 min-h-5">
        {playing ? t('hud.playing') : placedOk ? t('hud.hint') : t('hud.blocked')}
      </p>
      <Toast items={toasts} onDone={dropToast} />
      {paused && (
        <PauseMenu rotate={rotate} onRotate={changeRotate} onResume={() => setPaused(false)} onRestart={restart} onQuit={quit} />
      )}
      {boardEnd && (
        <BoardEndDialog game={boardEnd.next} boardNo={boardEnd.boardNo} winner={boardEnd.winner} points={boardEnd.points} onNext={nextBoard} />
      )}
      {gameEnd && (
        <GameEndScreen game={game} winner={gameEnd} onRematch={restart} onHome={quit} />
      )}
    </div>
  );
}
