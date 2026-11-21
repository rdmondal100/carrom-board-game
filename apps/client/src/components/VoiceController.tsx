import { useEffect, useMemo, useRef } from 'react';
import { toast } from 'sonner';
import type { LobbyView } from '@carrom/protocol';
import { t } from '@/i18n/t';
import { currentLobby, onServerMessage, sendToRoom } from '@/lib/colyseus';
import { onAppActive } from '@/lib/native';
import { createVoiceMesh, type VoiceMesh, type VoicePeer } from '@/lib/voice';
import { useAppDispatch, useAppSelector } from '@/store/store';
import { fetchIceServers, linksChanged, micDenied, speakingChanged, voiceReset } from '@/store/voiceSlice';

/** VOICE-4: voice is open in a private room; in a ranked room once everyone still there opted in. */
export function voiceOpenIn(lobby: LobbyView): boolean {
  if (!lobby.ranked) return true;
  const here = Object.values(lobby.players).filter((p) => !p.left);
  return here.length > 1 && here.every((p) => p.voiceOn);
}

/** The people this client should be linked with (sorted, so the key is stable). */
function peersOf(lobby: LobbyView | null, me: string | null): VoicePeer[] {
  if (!lobby || !me || !lobby.players[me]?.voiceOn || !voiceOpenIn(lobby)) return [];
  return Object.values(lobby.players)
    .filter((p) => p.sessionId !== me && p.voiceOn && !p.left)
    .map((p) => ({ sessionId: p.sessionId, userId: p.userId }))
    .sort((a, b) => (a.sessionId < b.sessionId ? -1 : 1));
}

/** What this player wants from voice right now (VOICE-4 defaults, settings, mic button). */
export function useVoiceWish(): { on: boolean; live: boolean } {
  const { lobby, sessionId } = useAppSelector((s) => s.room);
  const mode = useAppSelector((s) => s.settings.voiceMode);
  const v = useAppSelector((s) => s.voice);
  const me = lobby && sessionId ? lobby.players[sessionId] : undefined;
  const on = !!me && !me.left && mode !== 'off' && (!lobby?.ranked || v.optIn);
  const live = on && !v.micDenied && (mode === 'ptt' ? v.talking : v.micOn);
  return { on, live };
}

/**
 * VOICE-1..8: keeps the voice mesh in step with the room. Mounted once (in
 * RootLayout) so voice carries on from lobby to game in every game; leaving
 * the room or the page closes every link and stops the mic.
 */
export function VoiceController() {
  const dispatch = useAppDispatch();
  const { lobby, sessionId } = useAppSelector((s) => s.room);
  const blocked = useAppSelector((s) => s.auth.user?.blocked);
  const muted = useAppSelector((s) => s.voice.muted);
  const { on, live } = useVoiceWish();
  const meshRef = useRef<VoiceMesh | null>(null);
  const me = lobby && sessionId ? lobby.players[sessionId] : undefined;

  // Lobby patches come often (ready, rematch…); the mesh only hears when the set of people changes.
  const peerKey = peersOf(lobby, sessionId).map((p) => `${p.sessionId}/${p.userId}`).join(',');
  const peers = useMemo(() => (peerKey === '' ? [] : peerKey.split(',').map((s): VoicePeer => {
    const [sid = '', userId = ''] = s.split('/');
    return { sessionId: sid, userId };
  })), [peerKey]);

  // What a new mesh starts from (kept current after every render).
  const latest = useRef({ peers, live, blocked, muted });
  useEffect(() => { latest.current = { peers, live, blocked, muted }; });

  // VOICE-2: tell the room (again after a reconnect, which turns voice off server-side).
  const serverOn = me?.voiceOn;
  const serverMuted = me?.voiceMuted;
  useEffect(() => {
    if (serverOn === undefined) return;
    if (serverOn !== on || serverMuted !== !live) sendToRoom({ type: 'voiceState', on, muted: !live });
  }, [serverOn, serverMuted, on, live]);

  // The mesh lives while voice is on in this room.
  useEffect(() => {
    if (!on || !sessionId) return;
    const m = createVoiceMesh({
      me: sessionId,
      send: (to, signal) => sendToRoom({ type: 'voice', to, signal }),
      iceServers: fetchIceServers,
      userOf: (sid) => currentLobby()?.players[sid]?.userId ?? null,
      notify: (problem) => {
        toast(t(`voice.err.${problem}`));
        if (problem === 'micDenied') dispatch(micDenied());
      },
      onLinks: (l) => dispatch(linksChanged(l)),
      onSpeaking: (ids) => dispatch(speakingChanged(ids)),
    });
    meshRef.current = m;
    const now = latest.current;
    m.setBlocked(now.blocked ?? []);
    m.setMutedUsers(now.muted);
    m.setPeers(now.peers);
    void m.setMic(now.live);
    const offMsg = onServerMessage((msg) => {
      if (msg.type === 'voice') void m.handleSignal(msg.from, msg.signal);
    });
    const offApp = onAppActive((active) => m.setPaused(!active));
    const onHide = () => m.close();
    window.addEventListener('pagehide', onHide);
    return () => {
      offMsg();
      offApp();
      window.removeEventListener('pagehide', onHide);
      m.close();
      meshRef.current = null;
      dispatch(linksChanged({}));
      dispatch(speakingChanged([]));
    };
  }, [on, sessionId, dispatch]);

  useEffect(() => { meshRef.current?.setPeers(peers); }, [peers]);
  useEffect(() => { void meshRef.current?.setMic(live); }, [live]);
  useEffect(() => { meshRef.current?.setBlocked(blocked ?? []); }, [blocked]);
  useEffect(() => { meshRef.current?.setMutedUsers(muted); }, [muted]);

  // Out of the room: back to the defaults (mic off) for the next one.
  const inRoom = lobby !== null;
  useEffect(() => { if (!inRoom) dispatch(voiceReset()); }, [inRoom, dispatch]);
  return null;
}
