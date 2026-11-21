import { useState, type ReactNode } from 'react';
import { toast } from 'sonner';
import { Mic, MicOff, VolumeX } from 'lucide-react';
import { REPORT_REASONS, type PlayerView, type ReportReason } from '@carrom/protocol';
import { Avatar } from '@/components/Avatar';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { t, useLang } from '@/i18n/t';
import { currentRoom } from '@/lib/colyseus';
import { cn } from '@/lib/utils';
import { useAppDispatch, useAppSelector } from '@/store/store';
import { blockPlayer, reportPlayer, setMicOn, setOptIn, setTalking, toggleMuted } from '@/store/voiceSlice';
import { useVoiceWish, voiceOpenIn } from './VoiceController';

/** VOICE-5 a green ring around a speaking player's avatar. */
export function SpeakingRing({ sessionId, children }: { sessionId: string; children: ReactNode }) {
  const speaking = useAppSelector((s) => s.voice.speaking.includes(sessionId));
  return (
    <span
      data-speaking={speaking || undefined}
      className={cn('inline-flex shrink-0 rounded-full transition-shadow', speaking && 'ring-2 ring-green-500 ring-offset-2 ring-offset-background')}
    >
      {children}
    </span>
  );
}

/** VOICE-4 / VOICE-5: "Turn on voice" (ranked), the mic toggle, or push-to-talk. */
export function MicButton() {
  useLang();
  const dispatch = useAppDispatch();
  const lobby = useAppSelector((s) => s.room.lobby);
  const mode = useAppSelector((s) => s.settings.voiceMode);
  const v = useAppSelector((s) => s.voice);
  const { on, live } = useVoiceWish();
  if (!lobby || mode === 'off') return null;
  if (lobby.ranked && !v.optIn) {
    return <Button size="sm" variant="outline" onClick={() => dispatch(setOptIn(true))}><Mic />{t('voice.optIn')}</Button>;
  }
  if (!on) return null;
  const waiting = lobby.ranked && !voiceOpenIn(lobby);
  const label = mode === 'ptt' ? t('voice.hold') : live ? t('voice.micOn') : t('voice.micOff');
  const icon = live ? <Mic /> : <MicOff />;
  const button = mode === 'ptt' ? (
    <Button
      size="sm" variant={live ? 'default' : 'secondary'} aria-pressed={live} className="touch-none select-none"
      onPointerDown={(e) => { e.preventDefault(); dispatch(setTalking(true)); }}
      onPointerUp={() => dispatch(setTalking(false))}
      onPointerLeave={() => dispatch(setTalking(false))}
      onPointerCancel={() => dispatch(setTalking(false))}
      onKeyDown={(e) => { if (e.key === ' ' && !e.repeat) dispatch(setTalking(true)); }}
      onKeyUp={(e) => { if (e.key === ' ') dispatch(setTalking(false)); }}
      onContextMenu={(e) => e.preventDefault()}
    >
      {icon}{label}
    </Button>
  ) : (
    <Button size="sm" variant={live ? 'default' : 'secondary'} aria-pressed={live} onClick={() => dispatch(setMicOn(!v.micOn))}>
      {icon}{label}
    </Button>
  );
  return (
    <span className="flex items-center gap-2">
      {button}
      {waiting && <span className="text-xs text-muted-foreground">{t('voice.waitOthers')}</span>}
      {lobby.ranked && (
        <button type="button" className="text-xs text-muted-foreground underline" onClick={() => dispatch(setOptIn(false))}>
          {t('voice.optOut')}
        </button>
      )}
    </span>
  );
}

/** One other player in the voice strip: avatar, speaking ring, quiet link state. Tap = mute / block / report. */
function VoicePlayer({ p, onOpen }: { p: PlayerView; onOpen: () => void }) {
  const link = useAppSelector((s) => s.voice.links[p.sessionId]);
  const mutedByMe = useAppSelector((s) => s.voice.muted.includes(p.userId));
  const blocked = useAppSelector((s) => s.auth.user?.blocked.includes(p.userId) ?? false);
  const quiet = blocked ? t('voice.blockedOne') : mutedByMe ? t('voice.muted')
    : link === 'connecting' ? t('voice.connecting') : link === 'failed' ? t('voice.failed') : '';
  return (
    <button type="button" onClick={onOpen} className="flex min-w-0 items-center gap-1.5 rounded-full py-0.5 pr-2 pl-0.5 hover:bg-accent"
      aria-label={t('voice.player', { name: p.name })} data-testid={`voice-player-${p.sessionId}`}>
      <SpeakingRing sessionId={p.sessionId}><Avatar index={p.avatar} name={p.name} size="sm" /></SpeakingRing>
      <span className="max-w-20 truncate text-xs">{p.name}</span>
      {(mutedByMe || blocked) && <VolumeX className="size-3.5 text-muted-foreground" />}
      {!mutedByMe && !blocked && p.voiceOn && p.voiceMuted && <MicOff className="size-3.5 text-muted-foreground" />}
      {quiet && <span className="sr-only">{quiet}</span>}
      {link === 'connecting' && <span className="size-1.5 animate-pulse rounded-full bg-amber-400" aria-hidden />}
      {link === 'failed' && <span className="size-1.5 rounded-full bg-red-500" aria-hidden />}
    </button>
  );
}

type MenuView = 'main' | 'block' | 'report';

/** VOICE-5 / VOICE-6: per-player mute, block (for good), report. */
function PlayerVoiceMenu({ p, onClose }: { p: PlayerView; onClose: () => void }) {
  const dispatch = useAppDispatch();
  const [view, setView] = useState<MenuView>('main');
  const [busy, setBusy] = useState(false);
  const mutedByMe = useAppSelector((s) => s.voice.muted.includes(p.userId));
  const blocked = useAppSelector((s) => s.auth.user?.blocked.includes(p.userId) ?? false);

  const doBlock = async () => {
    setBusy(true);
    const r = await dispatch(blockPlayer(p.userId));
    setBusy(false);
    if (blockPlayer.fulfilled.match(r)) {
      toast(t('voice.blocked', { name: p.name }));
      onClose();
    } else toast(r.payload ?? t('online.err.network'));
  };
  const doReport = async (reason: ReportReason) => {
    setBusy(true);
    const r = await dispatch(reportPlayer({ userId: p.userId, matchId: currentRoom()?.roomId ?? 'unknown', reason }));
    setBusy(false);
    if (reportPlayer.fulfilled.match(r)) {
      toast(t('voice.reported'));
      onClose();
    } else toast(r.payload ?? t('online.err.network'));
  };

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-xs p-6">
        <DialogHeader>
          <DialogTitle>
            {view === 'report' ? t('voice.reportTitle', { name: p.name })
              : view === 'block' ? t('voice.blockConfirm', { name: p.name }) : p.name}
          </DialogTitle>
        </DialogHeader>
        {view === 'main' && (
          <div className="flex flex-col gap-2">
            {!blocked && (
              <Button variant="outline" onClick={() => dispatch(toggleMuted(p.userId))}>
                {mutedByMe ? t('voice.unmute') : t('voice.mute')}
              </Button>
            )}
            {!blocked && <Button variant="outline" onClick={() => setView('block')}>{t('voice.block')}</Button>}
            <Button variant="outline" onClick={() => setView('report')}>{t('voice.report')}</Button>
          </div>
        )}
        {view === 'report' && (
          <div className="flex flex-col gap-2">
            {REPORT_REASONS.map((r) => (
              <Button key={r} variant="outline" disabled={busy} onClick={() => void doReport(r)}>{t(`voice.reason.${r}`)}</Button>
            ))}
          </div>
        )}
        <DialogFooter className="flex-row justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>{t('voice.close')}</Button>
          {view === 'block' && <Button variant="destructive" disabled={busy} onClick={() => void doBlock()}>{t('voice.block')}</Button>}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** VOICE-5 the voice strip for lobby and game screens (any game): mic control plus the other players. */
export function VoiceBar({ className }: { className?: string }) {
  useLang();
  const { lobby, sessionId } = useAppSelector((s) => s.room);
  const mode = useAppSelector((s) => s.settings.voiceMode);
  const [menuFor, setMenuFor] = useState<string | null>(null);
  if (!lobby || mode === 'off') return null;
  const others = Object.values(lobby.players).filter((p) => p.sessionId !== sessionId && !p.left);
  const menuPlayer = menuFor ? lobby.players[menuFor] : undefined;
  return (
    <div className={cn('flex flex-wrap items-center gap-2', className)} data-testid="voice-bar">
      <MicButton />
      {others.map((p) => <VoicePlayer key={p.sessionId} p={p} onOpen={() => setMenuFor(p.sessionId)} />)}
      {menuPlayer && <PlayerVoiceMenu p={menuPlayer} onClose={() => setMenuFor(null)} />}
    </div>
  );
}
