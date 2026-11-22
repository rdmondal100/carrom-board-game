import { useEffect, useMemo, useRef, useState } from 'react';
import { Headphones, Mic, MicOff, PhoneOff } from 'lucide-react';
import { toast } from 'sonner';
import { LOUNGE_MAX } from '@carrom/protocol';
import { PlayerRow } from '@/components/AddaParts';
import { Button } from '@/components/ui/button';
import { Card, CardTitle } from '@/components/ui/card';
import { t } from '@/i18n/t';
import { joinLounge, type Lounge, type LoungeMemberView } from '@/lib/lounge';
import { onAppActive } from '@/lib/native';
import { createVoiceMesh, type VoiceMesh, type VoicePeer } from '@/lib/voice';
import { roomFailure } from '@/store/roomSlice';
import { useAppSelector } from '@/store/store';
import { fetchIceServers } from '@/store/voiceSlice';

/** ADDA-5 the people this client links with: everyone else with voice on (sorted, for a stable key). */
export function loungePeers(members: readonly LoungeMemberView[], me: string): VoicePeer[] {
  return members.filter((m) => m.sessionId !== me && m.voiceOn)
    .map((m) => ({ sessionId: m.sessionId, userId: m.userId }))
    .sort((a, b) => (a.sessionId < b.sessionId ? -1 : 1));
}

/**
 * ADDA-5 a group's voice lounge outside games: join, talk (mic toggle),
 * leave. Same P2P mesh as game rooms (VOICE-1), at most LOUNGE_MAX people.
 * Not while this tab is in a game room (that room has its own voice).
 */
export function LoungeVoice({ groupId }: { groupId: string }) {
  const blocked = useAppSelector((s) => s.auth.user?.blocked);
  const inRoom = useAppSelector((s) => s.room.lobby !== null);
  const [lounge, setLounge] = useState<Lounge | null>(null);
  const [members, setMembers] = useState<LoungeMemberView[]>([]);
  const [joining, setJoining] = useState(false);
  const [micOn, setMicOn] = useState(false);
  const [speaking, setSpeaking] = useState<string[]>([]);
  const meshRef = useRef<VoiceMesh | null>(null);
  const membersRef = useRef<LoungeMemberView[]>([]);
  const loungeRef = useRef<Lounge | null>(null);
  const me = lounge?.sessionId ?? '';

  const peerKey = loungePeers(members, me).map((p) => `${p.sessionId}/${p.userId}`).join(',');
  const peers = useMemo(() => (peerKey === '' ? [] : peerKey.split(',').map((s): VoicePeer => {
    const [sessionId = '', userId = ''] = s.split('/');
    return { sessionId, userId };
  })), [peerKey]);

  const enter = async () => {
    setJoining(true);
    try {
      let mesh: VoiceMesh | null = null;
      const l = await joinLounge(groupId, {
        onMembers: (m) => { membersRef.current = m; setMembers(m); },
        onSignal: (from, signal) => void mesh?.handleSignal(from, signal),
        onClosed: () => { mesh?.close(); meshRef.current = null; loungeRef.current = null; setLounge(null); setMembers([]); setSpeaking([]); },
      });
      mesh = createVoiceMesh({
        me: l.sessionId,
        send: (to, signal) => l.send({ type: 'voice', to, signal }),
        iceServers: fetchIceServers,
        userOf: (sid) => membersRef.current.find((m) => m.sessionId === sid)?.userId ?? null,
        notify: (problem) => toast(t(`voice.err.${problem}`)),
        onSpeaking: setSpeaking,
      });
      meshRef.current = mesh;
      l.send({ type: 'voiceState', on: true, muted: true });
      loungeRef.current = l;
      setLounge(l);
    } catch (err) {
      const f = roomFailure(err);
      toast(f.status === 409 ? t('adda.lounge.full', { n: LOUNGE_MAX }) : f.status === 0 ? t('online.err.network') : f.error);
    } finally {
      setJoining(false);
    }
  };

  // Keep the mesh and the server in step with the people, the mic and blocks.
  useEffect(() => { meshRef.current?.setPeers(peers); }, [peers]);
  useEffect(() => { meshRef.current?.setBlocked(blocked ?? []); }, [blocked, lounge]);
  useEffect(() => {
    if (!lounge) return;
    void meshRef.current?.setMic(micOn).then((ok) => { if (micOn && !ok) setMicOn(false); });
    lounge.send({ type: 'voiceState', on: true, muted: !micOn });
  }, [micOn, lounge]);
  // VOICE-7 in the background: no mic, no sound. Leaving the page leaves the lounge.
  useEffect(() => onAppActive((active) => meshRef.current?.setPaused(!active)), []);
  useEffect(() => () => {
    meshRef.current?.close();
    void loungeRef.current?.leave();
  }, []);

  return (
    <Card className="gap-3" data-testid="lounge">
      <CardTitle className="flex items-center gap-2"><Headphones className="size-5" />{t('adda.lounge.title')}</CardTitle>
      {!lounge && (
        <>
          <p className="text-sm text-muted-foreground">{inRoom ? t('adda.lounge.inRoom') : t('adda.lounge.hint', { n: LOUNGE_MAX })}</p>
          <Button onClick={() => void enter()} disabled={joining || inRoom}>{t('adda.lounge.join')}</Button>
        </>
      )}
      {lounge && (
        <>
          <ul className="flex flex-col gap-1">
            {members.map((m) => (
              <PlayerRow key={m.sessionId} name={m.name} avatar={m.avatar}
                sub={<span className="text-xs text-muted-foreground">
                  {speaking.includes(m.sessionId) ? t('adda.lounge.talking') : m.voiceMuted ? t('voice.muted') : ''}
                  {m.sessionId === me ? ` (${t('lobby.you')})` : ''}
                </span>} />
            ))}
          </ul>
          <div className="flex gap-2">
            <Button className="flex-1" variant={micOn ? 'default' : 'outline'} onClick={() => setMicOn((v) => !v)} aria-pressed={micOn}>
              {micOn ? <Mic className="size-4" /> : <MicOff className="size-4" />}{micOn ? t('voice.micOn') : t('voice.micOff')}
            </Button>
            <Button variant="destructive" onClick={() => void lounge.leave()}><PhoneOff className="size-4" />{t('adda.lounge.leave')}</Button>
          </div>
        </>
      )}
    </Card>
  );
}
