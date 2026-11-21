import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { VoiceSignal } from '@carrom/protocol';
import { createVoiceMesh, OPUS_MAX_BITRATE, tuneOpus, type VoiceDeps, type VoicePeer } from './voice';
import type { LevelMeter } from './voiceLevel';

const SDP = 'v=0\r\nm=audio 9 UDP/TLS/RTP/SAVPF 111\r\na=rtpmap:111 opus/48000/2\r\na=fmtp:111 minptime=10;useinbandfec=1\r\n';

interface FakeSender { track: unknown; replaceTrack: (t: unknown) => Promise<void> }
interface FakeTransceiver { direction: string; sender: FakeSender }

/** A stand-in RTCPeerConnection: records what the mesh does with it. */
function fakePeer(cfg: RTCConfiguration) {
  const transceivers: FakeTransceiver[] = [];
  const addT = () => {
    const sender: FakeSender = { track: null, replaceTrack: async (t) => { sender.track = t; } };
    const t = { direction: 'recvonly', sender };
    transceivers.push(t);
    return t;
  };
  const pc = {
    cfg,
    closed: false,
    connectionState: 'new' as RTCPeerConnectionState,
    signalingState: 'stable' as RTCSignalingState,
    remoteDescription: null as RTCSessionDescriptionInit | null,
    localDescription: null as RTCSessionDescriptionInit | null,
    onicecandidate: null as ((e: { candidate: RTCIceCandidate | null }) => void) | null,
    ontrack: null as ((e: { streams: MediaStream[]; track: MediaStreamTrack }) => void) | null,
    onconnectionstatechange: null as (() => void) | null,
    transceivers,
    addTransceiver: (_kind: string, init?: { direction?: string }) => Object.assign(addT(), init),
    getTransceivers: () => transceivers,
    createOffer: async () => ({ type: 'offer', sdp: SDP }),
    createAnswer: async () => ({ type: 'answer', sdp: SDP }),
    setLocalDescription: async (d: RTCSessionDescriptionInit) => {
      pc.localDescription = d;
      pc.signalingState = d.type === 'offer' ? 'have-local-offer' : 'stable';
    },
    setRemoteDescription: async (d: RTCSessionDescriptionInit) => {
      pc.remoteDescription = d;
      if (d.type === 'offer' && transceivers.length === 0) addT();
      pc.signalingState = d.type === 'offer' ? 'have-remote-offer' : 'stable';
    },
    addIceCandidate: vi.fn(async () => {}),
    close: () => { pc.closed = true; },
  };
  return pc;
}
type FakePeer = ReturnType<typeof fakePeer>;

const flush = () => new Promise((r) => setTimeout(r, 0));
const peer = (id: string): VoicePeer => ({ sessionId: id, userId: `u-${id}` });
const fakeStream = () => {
  const track = { enabled: true, stopped: false, stop() { track.stopped = true; } };
  return { track, stream: { getAudioTracks: () => [track], getTracks: () => [track] } as unknown as MediaStream };
};

let pcs: FakePeer[];
let sent: { to: string; signal: VoiceSignal }[];
let notify: ReturnType<typeof vi.fn<VoiceDeps['notify']>>;
let audios: HTMLAudioElement[];
const meter: LevelMeter = { add: vi.fn(), remove: vi.fn(), close: vi.fn() };

function mesh(over: Partial<VoiceDeps> = {}) {
  return createVoiceMesh({
    me: 'm',
    send: (to, signal) => sent.push({ to, signal }),
    iceServers: async () => [{ urls: ['stun:test'] }],
    userOf: (sid) => `u-${sid}`,
    notify,
    createPeer: (cfg) => {
      const p = fakePeer(cfg);
      pcs.push(p);
      return p as unknown as RTCPeerConnection;
    },
    getUserMedia: async () => fakeStream().stream,
    createAudio: () => {
      const a = { muted: false, srcObject: null, pause: vi.fn(), play: vi.fn(async () => {}) } as unknown as HTMLAudioElement;
      audios.push(a);
      return a;
    },
    meter,
    ...over,
  });
}

beforeEach(() => {
  pcs = [];
  sent = [];
  audios = [];
  notify = vi.fn();
});

describe('voice mesh', () => {
  it('VOICE-5 joining 3 peers makes 3 connections; leaving closes all', async () => {
    const m = mesh();
    m.setPeers([peer('x'), peer('y'), peer('z')]);
    await flush();
    expect(pcs).toHaveLength(3);
    expect(m.linkCount()).toBe(3);
    expect(pcs[0]!.cfg.iceServers).toEqual([{ urls: ['stun:test'] }]);
    // 'm' < 'x','y','z': this side offers, with the Opus limits in the SDP.
    expect(sent.filter((s) => s.signal.kind === 'offer').map((s) => s.to)).toEqual(['x', 'y', 'z']);
    const offer = sent[0]!.signal;
    expect(offer.kind === 'offer' && offer.sdp).toContain(`maxaveragebitrate=${OPUS_MAX_BITRATE}`);

    // The same set again changes nothing; one leaving closes only that link.
    m.setPeers([peer('x'), peer('y'), peer('z')]);
    m.setPeers([peer('x'), peer('z')]);
    await flush();
    expect(pcs).toHaveLength(3);
    expect(pcs.map((p) => p.closed)).toEqual([false, true, false]);

    const mic = fakeStream();
    const m2 = mesh({ getUserMedia: async () => mic.stream });
    await m2.setMic(true);
    m.close();
    m2.close();
    expect(pcs.every((p) => p.closed)).toBe(true);
    expect(m.linkCount()).toBe(0);
    expect(mic.track.stopped).toBe(true);
  });

  it('VOICE-1 the higher session id answers; ICE before the offer is kept until then', async () => {
    const m = mesh({ me: 'z' });
    m.setPeers([peer('b')]);
    await flush();
    expect(sent).toEqual([]);
    await m.handleSignal('b', { kind: 'offer', sdp: SDP });
    expect(pcs).toHaveLength(1);
    expect(sent[0]).toMatchObject({ to: 'b', signal: { kind: 'answer' } });
    await m.handleSignal('b', { kind: 'ice', candidate: 'candidate:1', sdpMid: '0', sdpMLineIndex: 0 });
    expect(pcs[0]!.addIceCandidate).toHaveBeenCalledTimes(1);
  });

  it('VOICE-5 mic: attached to every link, muted by enabled=false, paused in the background', async () => {
    const mic = fakeStream();
    const m = mesh({ getUserMedia: async () => mic.stream });
    m.setPeers([peer('x'), peer('y')]);
    await flush();
    expect(await m.setMic(true)).toBe(true);
    expect(pcs.map((p) => p.transceivers[0]!.sender.track)).toEqual([mic.track, mic.track]);
    expect(mic.track.enabled).toBe(true);
    await m.setMic(false);
    expect(mic.track.enabled).toBe(false);
    await m.setMic(true);
    m.setPaused(true);
    expect(mic.track.enabled).toBe(false);
    m.setPaused(false);
    expect(mic.track.enabled).toBe(true);
  });

  it('VOICE-6 blocked user\'s track is never attached', async () => {
    const m = mesh();
    m.setBlocked(['u-x']);
    m.setPeers([peer('x'), peer('y')]);
    await flush();
    expect(pcs).toHaveLength(1);
    await m.handleSignal('x', { kind: 'offer', sdp: SDP });
    expect(pcs).toHaveLength(1);

    // y plays; once y is blocked the link closes and a late track is not attached.
    const y = pcs[0]!;
    const stream = {} as MediaStream;
    y.ontrack?.({ streams: [stream], track: {} as MediaStreamTrack });
    expect(audios).toHaveLength(1);
    expect(audios[0]!.srcObject).toBe(stream);
    m.setBlocked(['u-x', 'u-y']);
    expect(y.closed).toBe(true);
    expect(audios[0]!.srcObject).toBeNull();
    y.ontrack?.({ streams: [stream], track: {} as MediaStreamTrack });
    expect(audios[0]!.srcObject).toBeNull();
  });

  it('VOICE-5 per-player mute silences only that player', async () => {
    const m = mesh();
    m.setPeers([peer('x'), peer('y')]);
    await flush();
    for (const p of pcs) p.ontrack?.({ streams: [{} as MediaStream], track: {} as MediaStreamTrack });
    m.setMutedUsers(['u-y']);
    expect(audios.map((a) => a.muted)).toEqual([false, true]);
  });

  it('VOICE-8 getUserMedia rejected → one toast, no throw', async () => {
    const m = mesh({ getUserMedia: async () => { throw new DOMException('denied', 'NotAllowedError'); } });
    await expect(m.setMic(true)).resolves.toBe(false);
    await expect(m.setMic(true)).resolves.toBe(false);
    expect(notify).toHaveBeenCalledTimes(1);
    expect(notify).toHaveBeenCalledWith('micDenied');
  });

  it('VOICE-8 no ICE servers from the API → STUN fallback; a failed link → one toast', async () => {
    const m = mesh({ iceServers: async () => { throw new Error('offline'); } });
    m.setPeers([peer('x'), peer('y')]);
    await flush();
    expect(pcs[0]!.cfg.iceServers).toEqual([{ urls: ['stun:stun.l.google.com:19302'] }]);
    for (const p of pcs) {
      p.connectionState = 'failed';
      p.onconnectionstatechange?.();
    }
    expect(notify).toHaveBeenCalledTimes(1);
    expect(notify).toHaveBeenCalledWith('connectFailed');
  });
});

describe('tuneOpus', () => {
  it('VOICE-1 sets mono, 24 kbps, DTX and FEC on the Opus fmtp line', () => {
    const out = tuneOpus(SDP);
    expect(out).toContain('a=fmtp:111 minptime=10;useinbandfec=1;maxaveragebitrate=24000;stereo=0;sprop-stereo=0;usedtx=1');
    expect(tuneOpus('v=0\r\n')).toBe('v=0\r\n');
  });
});
