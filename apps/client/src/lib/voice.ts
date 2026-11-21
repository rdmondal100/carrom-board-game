import type { VoiceSignal } from '@carrom/protocol';
import { createLevelMeter, type LevelMeter } from './voiceLevel';

/**
 * VOICE-1 / VOICE-5: the room's voice as a peer-to-peer audio mesh. One
 * RTCPeerConnection per other person with voice on (max 3). The lower session
 * id makes the offer. Every link gets an audio transceiver at once, so the mic
 * is attached later with replaceTrack (no renegotiation). Failure is quiet
 * (VOICE-8): each problem is reported once and nothing throws.
 */

/** VOICE-1 Opus target: mono, at most 24 kbps, DTX in silence, FEC for lossy mobile links. */
export const OPUS_MAX_BITRATE = 24_000;
export const FALLBACK_ICE: RTCIceServer[] = [{ urls: ['stun:stun.l.google.com:19302'] }];

export type LinkState = 'connecting' | 'connected' | 'failed';
export type VoiceProblem = 'micDenied' | 'connectFailed';

export interface VoicePeer { sessionId: string; userId: string }

export interface VoiceDeps {
  /** This client's session id. */
  me: string;
  send(to: string, signal: VoiceSignal): void;
  iceServers(): Promise<RTCIceServer[]>;
  /** The user id behind a session in this room (null = not seated here). */
  userOf(sessionId: string): string | null;
  /** VOICE-8 called at most once per kind for the mesh's life. */
  notify(problem: VoiceProblem): void;
  onLinks?(links: Record<string, LinkState>): void;
  /** Session ids speaking now (this client's own id while its mic is loud). */
  onSpeaking?(ids: string[]): void;
  createPeer?(cfg: RTCConfiguration): RTCPeerConnection;
  getUserMedia?(c: MediaStreamConstraints): Promise<MediaStream>;
  /** Play (or stop, with null) one person's audio. Default: a hidden <audio> element. */
  createAudio?(): HTMLAudioElement;
  meter?: LevelMeter;
}

export interface VoiceMesh {
  /** The people to be linked with now (voice on, voice open). Blocked users are skipped. */
  setPeers(peers: readonly VoicePeer[]): void;
  handleSignal(from: string, signal: VoiceSignal): Promise<void>;
  /** Mic live or not. The first `true` asks for the mic; false when it can't be had. */
  setMic(live: boolean): Promise<boolean>;
  setBlocked(userIds: readonly string[]): void;
  setMutedUsers(userIds: readonly string[]): void;
  /** VOICE-7 app in the background: no mic, no sound. */
  setPaused(paused: boolean): void;
  close(): void;
  linkCount(): number;
}

interface Link {
  info: VoicePeer;
  pc: RTCPeerConnection;
  audio: HTMLAudioElement | null;
  /** ICE candidates that came before the remote description. */
  early: RTCIceCandidateInit[];
  state: LinkState;
}

/** VOICE-1 add Opus limits to the fmtp line of an SDP (what this side wants to receive). */
export function tuneOpus(sdp: string): string {
  const pt = /a=rtpmap:(\d+) opus\/48000/i.exec(sdp)?.[1];
  if (!pt) return sdp;
  const extra = { maxaveragebitrate: String(OPUS_MAX_BITRATE), stereo: '0', 'sprop-stereo': '0', useinbandfec: '1', usedtx: '1' };
  const line = new RegExp(`^a=fmtp:${pt} (.*)$`, 'm');
  const m = line.exec(sdp);
  if (!m) return sdp.replace(new RegExp(`(a=rtpmap:${pt} [^\\r\\n]*)`), `$1\r\na=fmtp:${pt} ${new URLSearchParams(extra).toString().replaceAll('&', ';')}`);
  const params = new Map((m[1] ?? '').split(';').filter(Boolean).map((kv) => kv.trim().split('=') as [string, string]));
  for (const [k, v] of Object.entries(extra)) params.set(k, v);
  return sdp.replace(line, `a=fmtp:${pt} ${[...params].map(([k, v]) => `${k}=${v}`).join(';')}`);
}

const MIC: MediaStreamConstraints = {
  audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1 },
  video: false,
};

export function createVoiceMesh(deps: VoiceDeps): VoiceMesh {
  const newPeer = deps.createPeer ?? ((cfg) => new RTCPeerConnection(cfg));
  const getMic = deps.getUserMedia ?? ((c) => navigator.mediaDevices.getUserMedia(c));
  const newAudio = deps.createAudio ?? (() => {
    const a = document.createElement('audio');
    a.autoplay = true;
    return a;
  });
  const meter = deps.meter ?? createLevelMeter((ids) => deps.onSpeaking?.(ids));
  const links = new Map<string, Link>();
  const told = new Set<VoiceProblem>();
  let blocked = new Set<string>();
  let mutedUsers = new Set<string>();
  let wanted: VoicePeer[] = [];
  let mic: MediaStream | null = null;
  let micAsk: Promise<MediaStream | null> | null = null;
  let live = false;
  let paused = false;
  let closed = false;
  const ice = deps.iceServers().catch(() => FALLBACK_ICE);

  const tell = (p: VoiceProblem) => {
    if (told.has(p)) return;
    told.add(p);
    deps.notify(p);
  };
  const report = () => deps.onLinks?.(Object.fromEntries([...links].map(([id, l]) => [id, l.state])));
  const isBlocked = (userId: string | null) => userId !== null && blocked.has(userId);
  const micTrack = () => mic?.getAudioTracks()[0] ?? null;
  const applyAudio = (l: Link) => {
    if (l.audio) l.audio.muted = paused || mutedUsers.has(l.info.userId);
  };
  const applyMic = () => {
    const tr = micTrack();
    if (tr) tr.enabled = live && !paused;
  };
  const sendTrack = (l: Link) => {
    const tr = l.pc.getTransceivers()[0];
    if (!tr) return;
    tr.direction = 'sendrecv';
    void tr.sender.replaceTrack(micTrack()).catch(() => {});
  };

  const drop = (id: string) => {
    const l = links.get(id);
    if (!l) return;
    links.delete(id);
    l.pc.onicecandidate = null;
    l.pc.ontrack = null;
    l.pc.onconnectionstatechange = null;
    l.pc.close();
    if (l.audio) {
      l.audio.pause();
      l.audio.srcObject = null;
    }
    meter.remove(id);
    report();
  };

  const open = (info: VoicePeer, servers: RTCIceServer[]): Link => {
    const pc = newPeer({ iceServers: servers, bundlePolicy: 'max-bundle' });
    const l: Link = { info, pc, audio: null, early: [], state: 'connecting' };
    links.set(info.sessionId, l);
    pc.onicecandidate = (e) => {
      const c = e.candidate;
      if (c && c.candidate) deps.send(info.sessionId, { kind: 'ice', candidate: c.candidate, sdpMid: c.sdpMid ?? null, sdpMLineIndex: c.sdpMLineIndex ?? null });
    };
    pc.ontrack = (e) => {
      // VOICE-6: a blocked player's audio is never attached.
      if (closed || isBlocked(l.info.userId) || links.get(info.sessionId) !== l) return;
      const stream = e.streams[0] ?? new MediaStream([e.track]);
      l.audio ??= newAudio();
      l.audio.srcObject = stream;
      applyAudio(l);
      void l.audio.play?.()?.catch?.(() => {});
      meter.add(info.sessionId, stream);
    };
    pc.onconnectionstatechange = () => {
      const s = pc.connectionState;
      const next: LinkState | null = s === 'connected' ? 'connected' : s === 'failed' ? 'failed' : null;
      if (!next || next === l.state) return;
      l.state = next;
      if (next === 'failed') tell('connectFailed');
      report();
    };
    report();
    return l;
  };

  const offer = async (l: Link) => {
    l.pc.addTransceiver('audio', { direction: 'sendrecv' });
    sendTrack(l);
    const o = await l.pc.createOffer();
    const sdp = tuneOpus(o.sdp ?? '');
    await l.pc.setLocalDescription({ type: 'offer', sdp });
    deps.send(l.info.sessionId, { kind: 'offer', sdp });
  };

  const sync = async () => {
    const servers = await ice;
    if (closed) return;
    const keep = new Set(wanted.filter((p) => !isBlocked(p.userId)).map((p) => p.sessionId));
    for (const id of [...links.keys()]) if (!keep.has(id)) drop(id);
    for (const p of wanted) {
      if (!keep.has(p.sessionId) || links.has(p.sessionId)) continue;
      const l = open(p, servers);
      if (deps.me < p.sessionId) void offer(l).catch(() => drop(p.sessionId));
    }
  };

  const flushEarly = async (l: Link) => {
    for (const c of l.early.splice(0)) await l.pc.addIceCandidate(c).catch(() => {});
  };

  return {
    setPeers(peers) {
      wanted = peers.filter((p) => p.sessionId !== deps.me);
      void sync();
    },

    async handleSignal(from, signal) {
      try {
        const servers = await ice;
        if (closed || isBlocked(deps.userOf(from))) return;
        let l = links.get(from);
        if (signal.kind === 'offer') {
          // A fresh offer for a link that already had one = the other side started over.
          if (l?.pc.remoteDescription) {
            drop(from);
            l = undefined;
          }
          const userId = deps.userOf(from);
          if (!userId) return;
          l ??= open({ sessionId: from, userId }, servers);
          await l.pc.setRemoteDescription({ type: 'offer', sdp: signal.sdp });
          sendTrack(l);
          const a = await l.pc.createAnswer();
          const sdp = tuneOpus(a.sdp ?? '');
          await l.pc.setLocalDescription({ type: 'answer', sdp });
          deps.send(from, { kind: 'answer', sdp });
          await flushEarly(l);
        } else if (signal.kind === 'answer') {
          if (!l || l.pc.signalingState !== 'have-local-offer') return;
          await l.pc.setRemoteDescription({ type: 'answer', sdp: signal.sdp });
          await flushEarly(l);
        } else if (l) {
          const c: RTCIceCandidateInit = { candidate: signal.candidate, sdpMid: signal.sdpMid, sdpMLineIndex: signal.sdpMLineIndex };
          if (l.pc.remoteDescription) await l.pc.addIceCandidate(c).catch(() => {});
          else l.early.push(c);
        }
      } catch {
        // A bad or out-of-date signal: that link just doesn't come up.
      }
    },

    async setMic(on) {
      live = on;
      if (on && !mic && !closed) {
        micAsk ??= getMic(MIC).catch(() => null);
        const got = await micAsk;
        micAsk = null;
        if (!got) {
          live = false;
          tell('micDenied');
          return false;
        }
        if (closed) {
          got.getTracks().forEach((tr) => tr.stop());
          return false;
        }
        mic = got;
        meter.add(deps.me, got);
        for (const l of links.values()) sendTrack(l);
      }
      applyMic();
      return mic !== null || !on;
    },

    setBlocked(userIds) {
      blocked = new Set(userIds);
      for (const [id, l] of [...links]) if (blocked.has(l.info.userId)) drop(id);
    },

    setMutedUsers(userIds) {
      mutedUsers = new Set(userIds);
      links.forEach(applyAudio);
    },

    setPaused(p) {
      paused = p;
      applyMic();
      links.forEach(applyAudio);
    },

    close() {
      if (closed) return;
      closed = true;
      for (const id of [...links.keys()]) drop(id);
      mic?.getTracks().forEach((tr) => tr.stop());
      mic = null;
      meter.close();
    },

    linkCount: () => links.size,
  };
}
