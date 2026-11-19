import { useEffect, useRef, useState } from 'react';
import { Navigate, useNavigate } from 'react-router';
import { toast } from 'sonner';
import { config, type BoardState, type Seat, type ShotEvent, type ShotInput } from '@carrom/engine';
import type { LobbyView, ServerMessage } from '@carrom/protocol';
import type { RuleEvent } from '@carrom/rules';
import { EmoteBar, EMOTE_ICONS } from '@/components/EmoteBar';
import { GameEndScreen } from '@/components/GameEndScreen';
import { Hud } from '@/components/Hud';
import { useOnlineRoom } from '@/components/OnlineParts';
import { ShotClock } from '@/components/ShotClock';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { soundsForEvents } from '@/game/eventSounds';
import { coinKey, reasonKey, teamLabel } from '@/game/hud';
import { seatName, type LocalGame } from '@/game/localGame';
import {
  advance, animate, asLocalGame, canShoot, catchUp, dropOwnShot, fromLog, hashMatches, nextStep, playerAt, seatOf,
  SHOT_ERRORS, type Online,
} from '@/game/onlineGame';
import { useBoardCanvas, type RemoteAim } from '@/game/useBoardCanvas';
import { t, useLang } from '@/i18n/t';
import { gameLog, onServerMessage, sendToRoom } from '@/lib/colyseus';
import { buzz, playSound, POCKET_BUZZ_MS } from '@/lib/sound';
import { leaveRoom } from '@/store/roomSlice';
import { useAppDispatch } from '@/store/store';

type Clock = { turnId: number; ms: number };
/** ROOM-6: send at most 10 aims a second (the server drops the rest). */
const AIM_SEND_GAP_MS = 100;

function playEvents(events: ShotEvent[], board: BoardState): void {
  for (const cue of soundsForEvents(events, board)) {
    playSound(cue.kind, cue.strength);
    if (cue.kind === 'pocket') buzz(POCKET_BUZZ_MS);
  }
}

function lastClock(log: readonly ServerMessage[]): Clock | null {
  const c = [...log].reverse().find((m) => m.type === 'clock');
  return c ? { turnId: c.turnId, ms: c.ms } : null;
}

function announce(g: LocalGame, events: RuleEvent[]): void {
  for (const e of events) {
    if (e.type === 'returned') toast(t('toast.returned', { coin: t(coinKey(e.id)), reason: t(reasonKey(e.reason)) }));
    if (e.type === 'botTakeover') toast(t('toast.botTakeover', { name: seatName(g, e.seat) }));
    if (e.type === 'boardEnd') toast(t('online.boardEnd', { name: teamLabel(g, e.winner), points: e.points }));
  }
}

/** ROOM-8: tell everyone when a player drops, comes back, or leaves for good. */
function usePresenceToasts(lobby: LobbyView | null, me: string | null): void {
  const prev = useRef(lobby);
  useEffect(() => {
    const before = prev.current;
    prev.current = lobby;
    if (!before || !lobby) return;
    for (const p of Object.values(lobby.players)) {
      const was = before.players[p.sessionId];
      if (!was || p.sessionId === me) continue;
      if (p.left && !was.left) toast(t('online.left', { name: p.name }));
      else if (!p.left && was.ready && !p.ready) toast(t('online.away', { name: p.name }));
      else if (!p.left && !was.ready && p.ready) toast(t('online.back.player', { name: p.name }));
    }
  }, [lobby, me]);
}

/** ROOM-11: the online game page. Waits for the room and the first `game` message. */
export function OnlineGame() {
  useLang();
  const { lobby, sessionId } = useOnlineRoom();
  const [online, setOnline] = useState<Online | null>(() => fromLog(gameLog()));
  const [clock, setClock] = useState<Clock | null>(() => lastClock(gameLog()));
  usePresenceToasts(lobby, sessionId);

  // Each message folds in the whole log, so any that came before we listened are picked up too.
  useEffect(() => onServerMessage((m) => {
    if (m.type === 'clock') setClock({ turnId: m.turnId, ms: m.ms });
    if (m.type === 'error') {
      if (SHOT_ERRORS.includes(m.code)) setOnline((o) => o && dropOwnShot(o));
      toast(m.message);
    }
    setOnline((o) => catchUp(o, gameLog()));
  }), []);

  if (lobby?.phase === 'lobby') return <Navigate to="/online/lobby" replace />;
  if (!lobby || !online) return <p className="text-center text-muted-foreground">{t('online.connecting')}</p>;
  return <Play lobby={lobby} sessionId={sessionId} online={online} setOnline={setOnline} clock={clock} />;
}

interface PlayProps {
  lobby: LobbyView; sessionId: string | null; online: Online; clock: Clock | null;
  setOnline: (f: (o: Online | null) => Online | null) => void;
}

function Play({ lobby, sessionId, online, setOnline, clock }: PlayProps) {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const host = useRef<HTMLDivElement>(null);
  const me = seatOf(lobby, sessionId);
  const [view] = useState<Seat>(() => (me ?? 0) as Seat);
  const [playing, setPlaying] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const lastAim = useRef(0);
  const warned = useRef(false);
  const lastSeat = useRef(online.shown.turnSeat);
  const game = asLocalGame(online.shown, lobby);
  const gameRef = useRef(game);
  useEffect(() => { gameRef.current = game; });
  const shooter = online.shown.turnSeat;
  const myTurn = canShoot(online, me, playing);
  const botTurn = playerAt(lobby, shooter)?.bot === true;
  const mine = sessionId ? lobby.players[sessionId] : undefined;

  const board = useBoardCanvas(host, view, {
    onShot: (input: ShotInput) => {
      sendToRoom({ type: 'shot', turnId: online.turnId, input });
      setOnline((o) => o && animate(o, o.turnId));
    },
    onEvents: playEvents,
    onPlayingChange: setPlaying,
    onAim: (aim: RemoteAim) => {
      const now = performance.now();
      if (now - lastAim.current < AIM_SEND_GAP_MS) return;
      lastAim.current = now;
      sendToRoom({ type: 'aim', ...aim });
    },
  }, 'contain');

  // ROOM-6: show the shooter's aim as it comes in.
  useEffect(() => onServerMessage((m) => {
    if (m.type === 'aim' && m.seat !== me) board.current.showAim(m);
    if (m.type === 'emote') toast(`${EMOTE_ICONS[m.id]} ${seatName(gameRef.current, m.seat)}: ${t(`emote.${m.id}`)}`, { duration: 2000 });
  }), [board, me]);

  // Show the screen state whenever nothing is animating.
  useEffect(() => {
    if (!playing && online.animating === null) board.current.load(online.shown.board, shooter as Seat, view);
  }, [board, online.shown, online.animating, playing, shooter, view]);

  // ROOM-5: replay others' shots from our board; when a result is done, check its hash and show the server state.
  useEffect(() => {
    const step = nextStep(online, playing);
    if (step.kind === 'replay') {
      board.current.replay(step.msg.input);
      setOnline((o) => o && animate(o, step.msg.turnId));
    } else if (step.kind === 'finish') {
      if (!hashMatches(online.shown, step.msg) && !warned.current) {
        warned.current = true;
        console.warn(`ROOM-5 state hash mismatch at turn ${step.msg.turnId}; using the server state`);
        toast(t('online.desync'));
      }
      announce(gameRef.current, step.msg.ruleEvents);
      setOnline((o) => o && advance(o, step.msg.turnId));
    } else if (step.kind === 'timeout') {
      toast(t('toast.timeout', { name: seatName(gameRef.current, step.msg.seat) }));
      announce(gameRef.current, step.msg.ruleEvents);
      setOnline((o) => o && advance(o, step.msg.turnId));
    }
  }, [board, online, playing, setOnline]);

  useEffect(() => { board.current.setLocked(!myTurn); }, [board, myTurn]);
  useEffect(() => {
    if (shooter !== lastSeat.current) playSound('turn');
    lastSeat.current = shooter;
  }, [shooter]);

  const settled = !playing && online.animating === null && online.queue.length === 0;
  const over = settled && online.shown.winner !== null;
  const clockOn = settled && !over && !botTurn && clock !== null && clock.turnId === online.turnId;
  useEffect(() => { if (!clockOn) board.current.setClock(null); }, [board, clockOn]);

  const leave = async () => {
    await dispatch(leaveRoom());
    navigate('/');
  };
  const humans = Object.values(lobby.players).filter((p) => !p.left);
  const votes = humans.filter((p) => p.rematch).length;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2">
      <Hud
        game={game} onPause={() => setLeaving(true)} canPause pauseLabel={t('online.leave')}
        clock={clockOn ? (
          <ShotClock key={clock.turnId} startMs={clock.ms} running onTick={(f) => board.current.setClock(f)} onExpire={() => {}} />
        ) : null}
      />
      <div ref={host} data-testid="board-host" className="flex min-h-0 flex-1 items-center justify-center overflow-hidden select-none" />
      <p className="min-h-5 text-center text-sm text-muted-foreground">
        {playing ? t('hud.playing')
          : myTurn ? t('online.yourTurn')
            : botTurn ? t('online.botTurn', { name: seatName(game, shooter) })
              : t('online.waitTurn', { name: seatName(game, shooter) })}
      </p>
      {mine?.bot && !mine.left && (
        <Button className="self-center" size="sm" variant="outline"
          onClick={() => sendToRoom({ type: 'aim', x: 0, dirX: 0, dirY: 1, power: config.MIN_POWER })}>
          {t('online.takeBack')}
        </Button>
      )}
      <EmoteBar disabled={false} onSend={(id) => sendToRoom({ type: 'emote', id })} />
      {leaving && (
        <Dialog open onOpenChange={(o) => { if (!o) setLeaving(false); }}>
          <DialogContent className="p-6">
            <DialogHeader><DialogTitle>{t('online.leaveConfirm')}</DialogTitle></DialogHeader>
            <DialogFooter className="flex-row justify-end gap-2">
              <Button variant="outline" onClick={() => setLeaving(false)}>{t('pause.resume')}</Button>
              <Button variant="destructive" onClick={() => void leave()}>{t('online.leave')}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
      {over && online.shown.winner && (
        <GameEndScreen
          game={game} winner={online.shown.winner} onHome={() => void leave()}
          onRematch={() => sendToRoom({ type: 'rematch' })} rematchDisabled={mine?.rematch === true}
          note={mine?.rematch ? `${t('online.voted')} ${t('online.votes', { n: votes, total: humans.length })}` : t('online.votes', { n: votes, total: humans.length })}
        />
      )}
    </div>
  );
}
