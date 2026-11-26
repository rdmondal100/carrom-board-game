import { useEffect, useRef, useState } from 'react';
import { Navigate, useNavigate } from 'react-router';
import { toast } from 'sonner';
import type { LobbyView, ServerMessage } from '@carrom/protocol';
import { SEATS, type CallbreakMove } from '@hub/callbreak';
import { EmoteBar, EMOTE_ICONS } from '@/components/EmoteBar';
import { useOnlineRoom } from '@/components/OnlineParts';
import { VoiceBar } from '@/components/VoiceParts';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { CbClock, CbEndDialog, ScoreDialog } from '@/games/callbreak/components/CbParts';
import { ViewToggle } from '@/components/ViewToggle';
import { CbPlayArea } from '@/games/callbreak/components/CbPlayArea';
import { advance, canAct, catchUp, nextChange, namesOf, playerAt, seatOf, type CbOnline as Online } from '@/games/callbreak/online';
import { cbPath } from '@/games/callbreak/paths';
import { cbLook } from '@/games/callbreak/skins';
import { useFrames } from '@/games/callbreak/useFrames';
import { t, useLang } from '@/i18n/t';
import { onPauseRequest } from '@/lib/backButton';
import { gameLog, onServerMessage, sendToRoom } from '@/lib/colyseus';
import { playSound } from '@/lib/sound';
import { loadMe } from '@/store/authSlice';
import { leaveRoom } from '@/store/roomSlice';
import { useAppDispatch, useAppSelector } from '@/store/store';
import { announce, statusLine } from './CbLocal';

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

/** CB-8 the online Callbreak page. Waits for the room and the first `game` message (this seat's own view). */
export function CbOnline() {
  useLang();
  const dispatch = useAppDispatch();
  const { lobby, sessionId } = useOnlineRoom('callbreak');
  const [online, setOnline] = useState<Online | null>(() => catchUp(null, gameLog()));
  const [clock, setClock] = useState<Clock | null>(() => lastOf(gameLog(), 'clock') ?? null);
  usePresenceToasts(lobby, sessionId);

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

  if (lobby?.phase === 'lobby') return <Navigate to={cbPath('online/lobby')} replace />;
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
  const names = namesOf(lobby, (s) => t('callbreak.botN', { n: s + 1 }));
  const look = cbLook(useAppSelector((s) => s.auth.user?.cosmetics.equipped.callbreak));
  const [leaving, setLeaving] = useState(false);
  const [sheet, setSheet] = useState(false);
  const { frame, busy, play } = useFrames();
  const playingTurn = useRef<number | null>(null);
  const shown = online.shown;

  // The first deal of a new game, once.
  const opened = useRef(false);
  useEffect(() => {
    if (opened.current || online.origin.turnId !== 0) return;
    opened.current = true;
    play(online.origin, online.origin.recent, online.origin);
  }, [online.origin, play]);

  // Play each server change in turnId order, then show its view.
  useEffect(() => {
    const change = nextChange(online);
    if (!change || playingTurn.current === change.turnId) return;
    playingTurn.current = change.turnId;
    announce(names, change.events);
    play(shown, change.events, change.view, () => setOnline((o) => o && advance(o, change.turnId)));
  }, [names, online, play, setOnline, shown]);

  useEffect(() => onServerMessage((m) => {
    if (m.type === 'emote') toast(`${EMOTE_ICONS[m.id]} ${names[m.seat] ?? ''}: ${t(`emote.${m.id}`)}`, { duration: 2000 });
  }), [names]);
  useEffect(() => onPauseRequest(() => setLeaving(true)), []);
  useEffect(() => { if (!busy && shown.turnSeat === me && shown.winner === null) playSound('turn'); }, [busy, me, shown.turnSeat, shown.winner]);

  const bots = SEATS.filter((s) => playerAt(lobby, s)?.bot === true);
  const settled = !busy && online.queue.length === 0;
  const myTurn = canAct(online, me, busy);
  const send = (move: CallbreakMove) => {
    if (!myTurn) return;
    sendToRoom({ type: 'move', turnId: online.turnId, move });
    setOnline((o) => o && { ...o, sent: o.turnId });
  };
  const over = settled && shown.winner !== null;
  const botTurn = bots.includes(shown.turnSeat);
  const clockOn = settled && !over && !botTurn && clock !== null && clock.turnId === online.turnId;
  const mine = sessionId ? lobby.players[sessionId] : undefined;
  const humans = Object.values(lobby.players).filter((p) => !p.left);
  const votes = humans.filter((p) => p.rematch).length;

  const leave = async () => {
    await dispatch(leaveRoom());
    navigate('/');
  };

  return (
    <div className="mx-auto flex w-full max-w-xl min-h-0 flex-1 flex-col gap-2">
      <div className="flex items-center gap-2">
        <span className="flex-1 text-sm font-medium">{t('callbreak.round', { n: shown.round, total: shown.config.rounds })}</span>
        <Button size="sm" variant="outline" onClick={() => setSheet(true)}>{t('callbreak.scores')}</Button>
        <ViewToggle game="callbreak" />
        <Button size="sm" variant="ghost" onClick={() => setLeaving(true)}>{t('online.leave')}</Button>
      </div>
      <VoiceBar />
      <CbPlayArea view={shown} frame={frame} me={me ?? 0} names={names} bots={bots} canAct={myTurn} look={look}
        onBid={(bid) => send({ bid })} onPlay={(card) => send({ card })}>
        <p className="rounded-full bg-white/10 px-3 py-1 text-sm font-semibold empty:hidden" role="status">{statusLine(shown, names, shown.turnSeat === me, busy || !settled, botTurn)}</p>
        {clockOn && <CbClock key={clock.turnId} startMs={clock.ms} running onExpire={() => {}} />}
        {mine?.bot && !mine.left && (
          <Button size="sm" variant="outline" onClick={() => sendToRoom({ type: 'hint', data: null })}>{t('online.takeBack')}</Button>
        )}
      </CbPlayArea>
      <EmoteBar disabled={false} onSend={(id) => sendToRoom({ type: 'emote', id })} />
      <ScoreDialog open={sheet} onClose={() => setSheet(false)} scores={shown.scores} names={names} />
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
        <CbEndDialog winner={names[Number(shown.winner)] ?? ''} scores={shown.scores} names={names}
          onHome={() => void leave()} onRematch={() => sendToRoom({ type: 'rematch' })} rematchDisabled={mine?.rematch === true}
          note={mine?.rematch ? `${t('online.voted')} ${t('online.votes', { n: votes, total: humans.length })}` : t('online.votes', { n: votes, total: humans.length })} />
      )}
    </div>
  );
}
