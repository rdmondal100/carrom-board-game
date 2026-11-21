import { useEffect, useRef, useState } from 'react';
import { Navigate, useNavigate } from 'react-router';
import { toast } from 'sonner';
import type { LobbyView, ServerMessage } from '@carrom/protocol';
import { LUDO, legalTokens, ludoResult, seatsOf, type LudoMove, type LudoState } from '@hub/ludo';
import { EmoteBar, EMOTE_ICONS } from '@/components/EmoteBar';
import { useOnlineRoom } from '@/components/OnlineParts';
import { VoiceBar } from '@/components/VoiceParts';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Dice } from '@/games/ludo/components/Dice';
import { LudoBoard } from '@/games/ludo/components/LudoBoard';
import { LudoClock, LudoEndDialog, LudoRankedResult, PlayerStrip, standingsOf } from '@/games/ludo/components/LudoParts';
import { seatName, winnerLabel } from '@/games/ludo/localLudo';
import { advance, canAct, catchUp, ludoConfigOf, namesOf, nextChange, playerAt, seatOf, type LudoOnline as Online } from '@/games/ludo/online';
import { ludoPath } from '@/games/ludo/paths';
import { ludoLook, tokenSkin } from '@/games/ludo/skins';
import { usePlayback } from '@/games/ludo/usePlayback';
import { t, useLang } from '@/i18n/t';
import { onPauseRequest } from '@/lib/backButton';
import { gameLog, onServerMessage, sendToRoom } from '@/lib/colyseus';
import { playSound } from '@/lib/sound';
import { loadMe } from '@/store/authSlice';
import { leaveRoom } from '@/store/roomSlice';
import { useAppDispatch, useAppSelector } from '@/store/store';
import { announce } from './LudoLocal';

type Clock = { turnId: number; ms: number };
type RankedResult = Extract<ServerMessage, { type: 'rankedResult' }>;
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

/** LUDO-7 the online Ludo page (private and ranked rooms). Waits for the room and the first `game` message. */
export function LudoOnline() {
  useLang();
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { lobby, sessionId } = useOnlineRoom('ludo');
  const [online, setOnline] = useState<Online | null>(() => catchUp(null, gameLog()));
  const [clock, setClock] = useState<Clock | null>(() => lastOf(gameLog(), 'clock') ?? null);
  const [result, setResult] = useState<RankedResult | null>(() => lastOf(gameLog(), 'rankedResult') ?? null);
  usePresenceToasts(lobby, sessionId);

  useEffect(() => onServerMessage((m) => {
    if (m.type === 'clock') setClock({ turnId: m.turnId, ms: m.ms });
    if (m.type === 'rankedResult') {
      setResult(m);
      void dispatch(loadMe());
    }
    if (m.type === 'reward') {
      toast.success(t('reward.toast', { coins: m.coins }));
      void dispatch(loadMe());
    }
    if (m.type === 'error' && m.code === 'NO_OPPONENT') {
      toast(t('ranked.noOpponent'));
      navigate(ludoPath('ranked'), { replace: true });
      return;
    }
    if (m.type === 'error') {
      if (MOVE_ERRORS.includes(m.code)) setOnline((o) => o && { ...o, sent: null });
      toast(m.message);
    }
    setOnline((o) => catchUp(o, gameLog()));
  }), [dispatch, navigate]);

  if (lobby?.phase === 'lobby' && !lobby.ranked) return <Navigate to={ludoPath('online/lobby')} replace />;
  if (!lobby || !online) return <p className="text-center text-muted-foreground">{t('online.connecting')}</p>;
  return <Play key={originKey(online.origin)} lobby={lobby} sessionId={sessionId} online={online} setOnline={setOnline} clock={clock} result={result} />;
}

interface PlayProps {
  lobby: LobbyView; sessionId: string | null; online: Online; clock: Clock | null; result: RankedResult | null;
  setOnline: (f: (o: Online | null) => Online | null) => void;
}

function Play({ lobby, sessionId, online, setOnline, clock, result }: PlayProps) {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const me = seatOf(lobby, sessionId);
  const config = ludoConfigOf(lobby);
  const seats = seatsOf(config);
  const names = namesOf(lobby);
  const equipped = useAppSelector((s) => s.auth.user?.cosmetics.equipped.ludo);
  const userId = useAppSelector((s) => s.auth.user?.id ?? null);
  const look = ludoLook(equipped);
  const classic = tokenSkin(undefined);
  const [leaving, setLeaving] = useState(false);
  const { frame, busy, play } = usePlayback();
  const playingTurn = useRef<number | null>(null);
  const shown = online.shown;

  // The opening rolls of a new game, once.
  const opened = useRef(false);
  useEffect(() => {
    if (opened.current || online.origin.turnId !== 0) return;
    opened.current = true;
    play(online.origin.tokens.map((l) => l.map(() => LUDO.YARD)), online.origin.recent);
  }, [online.origin, play]);

  // Play each server change in turnId order, then show its view.
  useEffect(() => {
    const change = nextChange(online);
    if (!change || playingTurn.current === change.turnId) return;
    playingTurn.current = change.turnId;
    if (change.type === 'timeout') toast(t('toast.timeout', { name: seatName(names, change.seat) }), { duration: 1500 });
    announce(names, change.events.filter((e) => e.type !== 'timeout'));
    play(shown.tokens, change.events, () => setOnline((o) => o && advance(o, change.turnId)));
  }, [names, online, play, setOnline, shown.tokens]);

  useEffect(() => onServerMessage((m) => {
    if (m.type === 'emote') toast(`${EMOTE_ICONS[m.id]} ${seatName(names, m.seat)}: ${t(`emote.${m.id}`)}`, { duration: 2000 });
  }), [names]);
  useEffect(() => onPauseRequest(() => setLeaving(true)), []);
  useEffect(() => { if (!busy && shown.winner === null) playSound('turn'); }, [busy, shown.turnSeat, shown.winner]);

  const bots = seats.filter((s) => playerAt(lobby, s)?.bot === true);
  const settled = !busy && online.queue.length === 0;
  const myTurn = canAct(online, me, busy);
  const send = (move: LudoMove) => {
    if (!myTurn) return;
    sendToRoom({ type: 'move', turnId: online.turnId, move });
    setOnline((o) => o && { ...o, sent: o.turnId });
  };
  const legal = myTurn && shown.phase === 'move' && shown.dice !== null ? legalTokens(shown, shown.turnSeat, shown.dice) : [];
  const shownDice = frame?.dice ?? (shown.dice !== null ? { seat: shown.turnSeat, value: shown.dice } : null);
  const over = settled && shown.winner !== null;
  const botTurn = bots.includes(shown.turnSeat);
  const clockOn = settled && !over && !botTurn && clock !== null && clock.turnId === online.turnId;
  const mine = sessionId ? lobby.players[sessionId] : undefined;
  const humans = Object.values(lobby.players).filter((p) => !p.left);
  const votes = humans.filter((p) => p.rematch).length;
  const placings = over ? ludoResult(shown as LudoState)?.placings ?? [] : [];

  const leave = async (to = '/') => {
    await dispatch(leaveRoom());
    navigate(to);
  };

  return (
    <div className="mx-auto flex w-full max-w-xl min-h-0 flex-1 flex-col gap-2">
      <div className="flex items-center gap-2">
        <div className="flex-1"><PlayerStrip view={shown} seats={seats} names={names} bots={bots} me={me} /></div>
        <Button size="sm" variant="ghost" onClick={() => setLeaving(true)}>{t('online.leave')}</Button>
      </div>
      <VoiceBar />
      <LudoBoard seats={seats} tokens={frame?.tokens ?? shown.tokens} board={look.board}
        tokenSkinOf={(s) => (s === me ? look.tokens : classic)} viewSeat={me ?? seats[0]!} turnSeat={shown.turnSeat}
        legal={legal} onPick={(token) => send({ token })} label={t('ludo.board')} className="self-center" />
      <div className="flex items-center justify-center gap-4">
        <Dice value={shownDice?.value ?? null} skin={look.dice} rolling={frame?.cue === 'roll'} label={t('ludo.dice', { n: shownDice?.value ?? '?' })}
          onRoll={myTurn && shown.phase === 'roll' ? () => send({ roll: true }) : undefined} />
        <div className="flex flex-col items-start gap-1">
          <p className="text-sm" role="status">
            {over ? '' : busy ? t('ludo.moving') : myTurn ? (shown.phase === 'roll' ? t('ludo.yourRoll') : t('online.yourTurn'))
              : botTurn ? t('online.botTurn', { name: seatName(names, shown.turnSeat) }) : t('online.waitTurn', { name: seatName(names, shown.turnSeat) })}
          </p>
          {clockOn && <LudoClock key={clock.turnId} startMs={clock.ms} running onExpire={() => {}} />}
          {mine?.bot && !mine.left && (
            <Button size="sm" variant="outline" onClick={() => sendToRoom({ type: 'hint', data: null })}>{t('online.takeBack')}</Button>
          )}
        </div>
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
      {lobby.ranked && (over || result) && (
        <LudoRankedResult result={result} userId={userId} onAgain={() => void leave(ludoPath('ranked'))} onHome={() => void leave()} />
      )}
      {!lobby.ranked && over && shown.winner !== null && (
        <LudoEndDialog
          winner={winnerLabel(config, names, shown.winner)} standings={standingsOf(placings, seats, names)}
          onHome={() => void leave()} onRematch={() => sendToRoom({ type: 'rematch' })} rematchDisabled={mine?.rematch === true}
          note={mine?.rematch ? `${t('online.voted')} ${t('online.votes', { n: votes, total: humans.length })}` : t('online.votes', { n: votes, total: humans.length })}
        />
      )}
    </div>
  );
}
