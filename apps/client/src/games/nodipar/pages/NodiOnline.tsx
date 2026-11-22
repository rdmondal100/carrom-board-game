import { useEffect, useRef, useState } from 'react';
import { Navigate, useNavigate } from 'react-router';
import { toast } from 'sonner';
import type { Seat } from '@carrom/engine';
import type { LobbyView, ServerMessage } from '@carrom/protocol';
import { seatsOf, type NodiMove } from '@hub/nodipar';
import { EmoteBar, EMOTE_ICONS } from '@/components/EmoteBar';
import { useOnlineRoom } from '@/components/OnlineParts';
import { VoiceBar } from '@/components/VoiceParts';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { announce, NodiClock, NodiEndDialog, ScoreStrip, shotSounds } from '@/games/nodipar/components/NodiParts';
import { RiverBoard } from '@/games/nodipar/components/RiverBoard';
import { seatName } from '@/games/nodipar/localNodi';
import { advance, canAct, catchUp, namesOf, nextChange, playerAt, seatOf, type NodiOnline as Online } from '@/games/nodipar/online';
import { nodiPath } from '@/games/nodipar/paths';
import { boatSkin, nodiLook } from '@/games/nodipar/skins';
import type { RiverApi } from '@/games/nodipar/useRiverCanvas';
import { t, useLang } from '@/i18n/t';
import { onPauseRequest } from '@/lib/backButton';
import { gameLog, onServerMessage, sendToRoom } from '@/lib/colyseus';
import { playSound } from '@/lib/sound';
import { loadMe } from '@/store/authSlice';
import { leaveRoom } from '@/store/roomSlice';
import { useAppDispatch, useAppSelector } from '@/store/store';

type Clock = { turnId: number; ms: number };
const MOVE_ERRORS: readonly string[] = ['NOT_YOUR_TURN', 'STALE_TURN', 'BAD_MOVE', 'GAME_OVER', 'NOT_PLAYING', 'BAD_MESSAGE'];

const lastOf = <T extends ServerMessage['type']>(log: readonly ServerMessage[], type: T) =>
  [...log].reverse().find((m) => m.type === type) as Extract<ServerMessage, { type: T }> | undefined;

/** A new `game` message (start, rematch, rejoin) starts the screen over. */
const origins = new WeakMap<object, number>();
let lastOrigin = 0;
function originKey(view: object): number {
  if (!origins.has(view)) origins.set(view, ++lastOrigin);
  return origins.get(view)!;
}

/** NODI-5 the online Nodi Par page (private rooms). Waits for the room and the first `game` message. */
export function NodiOnline() {
  useLang();
  const dispatch = useAppDispatch();
  const { lobby, sessionId } = useOnlineRoom('nodipar');
  const [online, setOnline] = useState<Online | null>(() => catchUp(null, gameLog()));
  const [clock, setClock] = useState<Clock | null>(() => lastOf(gameLog(), 'clock') ?? null);

  useEffect(() => onServerMessage((m) => {
    if (m.type === 'clock') setClock({ turnId: m.turnId, ms: m.ms });
    if (m.type === 'reward') {
      toast.success(t('reward.toast', { coins: m.coins }));
      void dispatch(loadMe());
    }
    if (m.type === 'error') {
      if (MOVE_ERRORS.includes(m.code)) setOnline((o) => o && { ...o, sent: null });
      toast(m.message);
    }
    setOnline((o) => catchUp(o, gameLog()));
  }), [dispatch]);

  if (lobby?.phase === 'lobby') return <Navigate to={nodiPath('online/lobby')} replace />;
  if (!lobby || !online) return <p className="text-center text-muted-foreground">{t('online.connecting')}</p>;
  return <Play key={originKey(online.origin)} lobby={lobby} sessionId={sessionId} online={online} setOnline={setOnline} clock={clock} />;
}

interface PlayProps {
  lobby: LobbyView; sessionId: string | null; online: Online; clock: Clock | null;
  setOnline: (f: (o: Online | null) => Online | null) => void;
}

function Play({ lobby, sessionId, online, setOnline, clock }: PlayProps) {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const me = seatOf(lobby, sessionId);
  const shown = online.shown;
  const seats = seatsOf(shown.config);
  const names = namesOf(lobby);
  const look = nodiLook(useAppSelector((s) => s.auth.user?.cosmetics.equipped.nodipar));
  const river = useRef<RiverApi>(null);
  const [busy, setBusy] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const playingTurn = useRef<number | null>(null);
  const viewSeat = (me ?? seats[0]!) as Seat;
  const myTurn = canAct(online, me, busy);

  useEffect(() => {
    const classic = boatSkin(undefined);
    river.current?.setLook((s) => (s === me ? look.boat : classic), look.river);
  }, [look.boat, look.river, me]);
  useEffect(() => { if (!busy) river.current?.show(shown, viewSeat); }, [busy, shown, viewSeat]);
  useEffect(() => { river.current?.setCanMove(myTurn && !leaving); }, [myTurn, leaving]);

  // Play each server change in turnId order, then show its view.
  useEffect(() => {
    const change = nextChange(online);
    if (!change || playingTurn.current === change.turnId) return;
    playingTurn.current = change.turnId;
    const done = () => {
      announce(change.view, names, change.events);
      setBusy(false);
      setOnline((o) => o && advance(o, change.turnId));
    };
    setBusy(true);
    if (change.type === 'moveResult' && river.current) river.current.play(change.seat, change.move, change.seat !== me, done);
    else done();
  }, [me, names, online, setOnline]);

  useEffect(() => onServerMessage((m) => {
    if (m.type === 'emote') toast(`${EMOTE_ICONS[m.id]} ${seatName(names, m.seat)}: ${t(`emote.${m.id}`)}`, { duration: 2000 });
  }), [names]);
  useEffect(() => onPauseRequest(() => setLeaving(true)), []);
  useEffect(() => { if (!busy && shown.winner === null) playSound('turn'); }, [busy, shown.turnSeat, shown.winner]);

  const send = (move: NodiMove) => {
    if (!myTurn) return;
    sendToRoom({ type: 'move', turnId: online.turnId, move });
    setOnline((o) => o && { ...o, sent: o.turnId });
  };
  const bots = seats.filter((s) => playerAt(lobby, s)?.bot === true);
  const settled = !busy && online.queue.length === 0;
  const over = settled && shown.winner !== null;
  const botTurn = bots.includes(shown.turnSeat);
  const clockOn = settled && !over && !botTurn && clock !== null && clock.turnId === online.turnId;
  const mine = sessionId ? lobby.players[sessionId] : undefined;
  const humans = Object.values(lobby.players).filter((p) => !p.left);
  const votes = humans.filter((p) => p.rematch).length;

  const leave = async (to = '/') => {
    await dispatch(leaveRoom());
    navigate(to);
  };

  return (
    <div className="mx-auto flex w-full max-w-xl min-h-0 flex-1 flex-col gap-2">
      <div className="flex items-start gap-2">
        <div className="flex-1"><ScoreStrip view={shown} names={names} bots={bots} me={me} /></div>
        <Button size="sm" variant="ghost" onClick={() => setLeaving(true)}>{t('online.leave')}</Button>
      </div>
      <VoiceBar />
      <RiverBoard ref={river} label={t('nodi.board')} className="self-center" onMove={send} onEvents={shotSounds} />
      <div className="flex flex-wrap items-center justify-center gap-3">
        <p className="text-sm" role="status">
          {over ? '' : busy ? t('nodi.moving') : myTurn ? t('nodi.yourTurn')
            : botTurn ? t('online.botTurn', { name: seatName(names, shown.turnSeat) }) : t('online.waitTurn', { name: seatName(names, shown.turnSeat) })}
        </p>
        {clockOn && <NodiClock key={clock.turnId} startMs={clock.ms} running onExpire={() => {}} />}
        {mine?.bot && !mine.left && (
          <Button size="sm" variant="outline" onClick={() => sendToRoom({ type: 'hint', data: null })}>{t('online.takeBack')}</Button>
        )}
      </div>
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
      {over && shown.winner !== null && (
        <NodiEndDialog view={shown} names={names}
          onHome={() => void leave()} onRematch={() => sendToRoom({ type: 'rematch' })} rematchDisabled={mine?.rematch === true}
          note={mine?.rematch ? `${t('online.voted')} ${t('online.votes', { n: votes, total: humans.length })}` : t('online.votes', { n: votes, total: humans.length })} />
      )}
    </div>
  );
}
