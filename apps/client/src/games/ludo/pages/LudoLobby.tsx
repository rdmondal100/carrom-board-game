import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router';
import { toast } from 'sonner';
import { Copy, Crown, Share2 } from 'lucide-react';
import type { LobbyView } from '@carrom/protocol';
import { seatsOf, teamOf } from '@hub/ludo';
import { Avatar } from '@/components/Avatar';
import { useOnlineRoom } from '@/components/OnlineParts';
import { SpeakingRing, VoiceBar } from '@/components/VoiceParts';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useAppName } from '@/games/appName';
import { ludoConfigOf, playerAt } from '@/games/ludo/online';
import { ludoPath } from '@/games/ludo/paths';
import { seatColor } from '@/games/ludo/skins';
import { t, useLang } from '@/i18n/t';
import { sendToRoom } from '@/lib/colyseus';
import { cn } from '@/lib/utils';
import { leaveRoom } from '@/store/roomSlice';
import { useAppDispatch } from '@/store/store';

const inviteUrl = (code: string): string => `${window.location.origin}/join/${code}`;

async function share(code: string, app: string): Promise<void> {
  const url = inviteUrl(code);
  if (typeof navigator.share === 'function') {
    try {
      await navigator.share({ title: app, text: t('lobby.shareText', { app }), url });
      return;
    } catch {
      // Cancelled or not allowed: copy instead.
    }
  }
  try {
    await navigator.clipboard.writeText(url);
    toast(t('lobby.copied'));
  } catch {
    toast(url);
  }
}

/** The room's rules in one line, e.g. "BD rules · 4 players · quick". */
export function rulesLine(lobby: Pick<LobbyView, 'config'>): string {
  const c = ludoConfigOf(lobby);
  const parts = [t(`ludo.preset.${c.preset}`), t(`ludo.count.${c.teams ? '2v2' : String(c.players)}`)];
  if (c.quick) parts.push(t('ludo.quickShort'));
  if (c.tapToRoll) parts.push(t('ludo.tapShort'));
  return parts.join(' · ');
}

interface SeatProps { lobby: LobbyView; seat: number; me: string | null; picked: boolean; onPick: (() => void) | null }

function SeatCard({ lobby, seat, me, picked, onPick }: SeatProps) {
  const p = playerAt(lobby, seat);
  const cfg = ludoConfigOf(lobby);
  const body = (
    <Card className={cn('flex-row items-center gap-3 p-3', picked && 'ring-2 ring-amber-400', onPick && 'cursor-pointer hover:bg-accent')}>
      <span className="size-3 shrink-0 rounded-full" style={{ background: seatColor(seat) }} />
      {p ? <SpeakingRing sessionId={p.sessionId}><Avatar index={p.avatar} name={p.name} /></SpeakingRing> : <span className="size-10 rounded-full border border-dashed border-border" />}
      <div className="min-w-0 flex-1">
        <p className="text-xs text-muted-foreground">
          {t(`ludo.color.${seat}`)}{cfg.teams && ` · ${t('lobby.team', { team: teamOf(cfg, seat) })}`}
        </p>
        <p className="truncate font-medium">{p ? p.name : t('lobby.waiting')}</p>
      </div>
      {p?.sessionId === lobby.hostId && <Crown aria-label={t('lobby.host')} className="size-4 text-amber-400" />}
      {p?.sessionId === me && <span className="rounded-full bg-primary/20 px-2 py-0.5 text-xs">{t('lobby.you')}</span>}
      {p && !p.ready && <span className="rounded-full bg-muted px-2 py-0.5 text-xs">{t('lobby.away')}</span>}
    </Card>
  );
  return onPick ? <button type="button" className="text-left" onClick={onPick} data-testid={`seat-${seat}`}>{body}</button> : body;
}

/** LUDO-7 invite link, seats by colour (the host swaps them), start. */
export function LudoLobby() {
  useLang();
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { lobby, sessionId } = useOnlineRoom('ludo');
  const [picked, setPicked] = useState<number | null>(null);
  const appName = useAppName();

  if (!lobby) return <p className="text-center text-muted-foreground">{t('online.connecting')}</p>;
  if (lobby.phase !== 'lobby' || lobby.ranked) return <Navigate to={ludoPath('online/game')} replace />;

  const seats = seatsOf(ludoConfigOf(lobby));
  const isHost = lobby.hostId === sessionId;
  const full = seats.every((s) => playerAt(lobby, s));
  const pick = (seat: number) => {
    if (picked === null) setPicked(seat);
    else {
      if (picked !== seat) sendToRoom({ type: 'swap', a: picked, b: seat });
      setPicked(null);
    }
  };
  const leave = async () => {
    await dispatch(leaveRoom());
    navigate(ludoPath('online'));
  };

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-4">
      <h2 className="text-xl font-bold">{t('lobby.title', { code: lobby.code })}</h2>
      <p className="text-sm text-muted-foreground">{rulesLine(lobby)}</p>
      <Card className="gap-2 p-4">
        <p className="text-sm">{t('lobby.invite')}</p>
        <p className="select-all break-all font-mono text-sm" data-testid="invite-url">{inviteUrl(lobby.code)}</p>
        <div className="flex gap-2">
          <Button className="flex-1" onClick={() => void share(lobby.code, appName)}><Share2 />{t('lobby.share')}</Button>
          <Button className="flex-1" variant="outline" onClick={() => void navigator.clipboard?.writeText(inviteUrl(lobby.code)).then(() => toast(t('lobby.copied')))}>
            <Copy />{t('lobby.copy')}
          </Button>
        </div>
      </Card>
      <VoiceBar />
      <div className="flex flex-col gap-2">
        {seats.map((s) => <SeatCard key={s} lobby={lobby} seat={s} me={sessionId} picked={picked === s} onPick={isHost ? () => pick(s) : null} />)}
        {isHost && <p className="text-xs text-muted-foreground">{t('lobby.swapHint')}</p>}
      </div>
      {isHost ? (
        <Button size="lg" disabled={!full} onClick={() => sendToRoom({ type: 'start' })}>{full ? t('lobby.start') : t('lobby.needAll')}</Button>
      ) : (
        <p className="text-center text-muted-foreground">{full ? t('lobby.waitHost') : t('lobby.needAll')}</p>
      )}
      <Button variant="ghost" onClick={() => void leave()}>{t('lobby.leave')}</Button>
    </div>
  );
}
