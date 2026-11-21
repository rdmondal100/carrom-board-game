import { describe, expect, it } from 'vitest';
import { parseClientMessage, parseServerMessage } from './schemas';
import { SDP_MAX } from './voice';

const offer = { kind: 'offer', sdp: 'v=0\r\n' };
const ice = { kind: 'ice', candidate: 'candidate:1 1 udp 2122260223 10.0.0.2 51000 typ host', sdpMid: '0', sdpMLineIndex: 0 };

describe('voice messages', () => {
  it('VOICE-2 voice and voiceState parse', () => {
    expect(parseClientMessage({ type: 'voice', to: 'abc', signal: offer })).not.toBeNull();
    expect(parseClientMessage({ type: 'voice', to: 'abc', signal: ice })).not.toBeNull();
    expect(parseClientMessage({ type: 'voice', to: 'abc', signal: { kind: 'ice', candidate: '', sdpMid: null, sdpMLineIndex: null } })).not.toBeNull();
    expect(parseClientMessage({ type: 'voiceState', on: true, muted: false })).not.toBeNull();
    expect(parseServerMessage({ type: 'voice', from: 'abc', signal: offer })).not.toBeNull();
  });

  it.each([
    ['no target', { type: 'voice', signal: offer }],
    ['empty target', { type: 'voice', to: '', signal: offer }],
    ['huge sdp', { type: 'voice', to: 'a', signal: { kind: 'offer', sdp: 'x'.repeat(SDP_MAX + 1) } }],
    ['unknown kind', { type: 'voice', to: 'a', signal: { kind: 'bye' } }],
    ['voiceState missing muted', { type: 'voiceState', on: true }],
  ])('VOICE-2 refuses %s', (_name, msg) => {
    expect(parseClientMessage(msg)).toBeNull();
  });
});
