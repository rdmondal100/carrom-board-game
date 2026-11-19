import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router';
import { toast } from 'sonner';
import { Copy, Crown, Share2 } from 'lucide-react';
import type { LobbyView } from '@carrom/protocol';
import { seatsFor, teamOf, type Format } from '@carrom/rules';
import { Avatar } from '@/components/Avatar';
import { useOnlineRoom } from '@/components/OnlineParts';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { playerAt } from '@/game/onlineGame';
import { t, useLang } from '@/i18n/t';
import { sendToRoom } from '@/lib/colyseus';
import { cn } from '@/lib/utils';
import { leaveRoom } from '@/store/roomSlice';
import { useAppDispatch } from '@/store/store';

const inviteUrl = (code: string): string => `${window.location.origin}/join/${code}`;

/** ROOM-11: Web Share API where there is one, else copy to the clipboard. */
async function share(code: string): Promise<void> {
  const url = inviteUrl(code);
  if (typeof navigator.share === 'function') {
    try {
      await navigator.share({ title: 'Carrom Adda', text: t('lobby.shareText'), url });
      return;
    } catch {
      // Cancelled or not allowed: fall back to copying.
    }
  }
  try {
    await navigator.clipboard.writeText(url);
    toast(t('lobby.copied'));
  } catch {
    toast(url);
  }
}

function lengthLabel(l: LobbyView): string {
  return t(`setup.length.${l.lengthKind === 'points' ? String(l.target) : 'board'}`);
}

interface SeatProps { lobby: LobbyView; seat: number; me: string | null; picked: boolean; onPick: (() => void) | null }

function SeatCard({ lobby, seat, me, picked, onPick }: SeatProps) {
  const p = playerAt(lobby, seat);
  const format = lobby.format as Format;
  const body = (
    <Card className={cn('flex-row items-center gap-3 p-3', picked && 'ring-2 ring-amber-400', onPick && 'cursor-pointer hover:bg-accent')}>
      {p ? <Avatar index={p.avatar} name={p.name} /> : <span className="size-10 rounded-full border border-dashed border-border" />}
      <div className="min-w-0 flex-1">
        <p className="text-xs text-muted-foreground">
          {t('lobby.seat', { n: (seatsFor(format) as number[]).indexOf(seat) + 1 })}
          {format === '2v2' && ` · ${t('lobby.team', { team: teamOf(seat, format) })}`}
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

/** ROOM-3 / ROOM-11: invite link, seats (the host swaps them), start. */
export function Lobby() {
  useLang();
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { lobby, sessionId } = useOnlineRoom();
  const [picked, setPicked] = useState<number | null>(null);

  if (!lobby) return <p className="text-center text-muted-foreground">{t('online.connecting')}</p>;
  if (lobby.phase !== 'lobby') return <Navigate to="/online/game" replace />;

  const format = lobby.format as Format;
  const seats = seatsFor(format);
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
    navigate('/online');
  };

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-4">
      <h2 className="text-xl font-bold">{t('lobby.title', { code: lobby.code })}</h2>
      <p className="text-sm text-muted-foreground">
        {t(`setup.format.${format}`)} · {t(`setup.preset.${lobby.preset}`)} · {lengthLabel(lobby)}
      </p>

      <Card className="gap-2 p-4">
        <p className="text-sm">{t('lobby.invite')}</p>
        <p className="select-all break-all font-mono text-sm" data-testid="invite-url">{inviteUrl(lobby.code)}</p>
        <div className="flex gap-2">
          <Button className="flex-1" onClick={() => void share(lobby.code)}><Share2 />{t('lobby.share')}</Button>
          <Button className="flex-1" variant="outline" onClick={() => void navigator.clipboard?.writeText(inviteUrl(lobby.code)).then(() => toast(t('lobby.copied')))}>
            <Copy />{t('lobby.copy')}
          </Button>
        </div>
      </Card>

      <div className="flex flex-col gap-2">
        {seats.map((s) => (
          <SeatCard key={s} lobby={lobby} seat={s} me={sessionId} picked={picked === s} onPick={isHost ? () => pick(s) : null} />
        ))}
        {isHost && <p className="text-xs text-muted-foreground">{t('lobby.swapHint')}</p>}
      </div>

      {isHost ? (
        <Button size="lg" disabled={!full} onClick={() => sendToRoom({ type: 'start' })}>
          {full ? t('lobby.start') : t('lobby.needAll')}
        </Button>
      ) : (
        <p className="text-center text-muted-foreground">{full ? t('lobby.waitHost') : t('lobby.needAll')}</p>
      )}
      <Button variant="ghost" onClick={() => void leave()}>{t('lobby.leave')}</Button>
    </div>
  );
}
