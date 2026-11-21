import { describe, expect, it } from 'vitest';
import { mayRelay, voiceOpen, type VoicePlayer } from './voiceRelay.js';

const p = (sessionId: string, voiceOn = true, left = false): VoicePlayer => ({ sessionId, voiceOn, left });
const room = (...ps: VoicePlayer[]) => new Map(ps.map((x) => [x.sessionId, x]));

describe('voice relay rules', () => {
  it('VOICE-2 only between two players here with voice on', () => {
    const r = room(p('a'), p('b'), p('c', false), p('d', true, true));
    expect(mayRelay(r, false, 'a', 'b')).toBe(true);
    expect(mayRelay(r, false, 'a', 'a')).toBe(false);
    expect(mayRelay(r, false, 'a', 'c')).toBe(false);
    expect(mayRelay(r, false, 'a', 'd')).toBe(false);
    expect(mayRelay(r, false, 'a', 'other-room-session')).toBe(false);
    expect(mayRelay(r, false, 'stranger', 'a')).toBe(false);
  });

  it('VOICE-4 ranked: open only when everyone still here opted in', () => {
    expect(voiceOpen([p('a'), p('b', false)], true)).toBe(false);
    expect(voiceOpen([p('a'), p('b')], true)).toBe(true);
    expect(voiceOpen([p('a')], true)).toBe(false);
    expect(voiceOpen([p('a'), p('b', false)], false)).toBe(true);
    expect(mayRelay(room(p('a'), p('b', false)), true, 'a', 'b')).toBe(false);
  });
});
