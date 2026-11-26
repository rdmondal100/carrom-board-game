import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setVolume } from '@/store/settingsSlice';
import { store } from '@/store/store';
import { playSound, resetAudioForTests, type SoundKind } from './sound';

const param = () => ({ setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() });
const node = () => ({ connect: (n: unknown) => n, start: vi.fn(), stop: vi.fn() });

function mockAudio() {
  const created = { ctx: 0, osc: 0, gain: 0, noise: 0, filter: 0 };
  class FakeAudioContext {
    currentTime = 0;
    sampleRate = 8000;
    state = 'running';
    destination = {};
    constructor() { created.ctx += 1; }
    resume() { return Promise.resolve(); }
    createBuffer(_ch: number, n: number) { return { getChannelData: () => new Float32Array(n) }; }
    createOscillator() {
      created.osc += 1;
      return { ...node(), type: 'sine', frequency: param() };
    }
    createBufferSource() {
      created.noise += 1;
      return { ...node(), buffer: null };
    }
    createBiquadFilter() {
      created.filter += 1;
      return { ...node(), type: 'lowpass', frequency: param(), Q: param() };
    }
    createGain() {
      created.gain += 1;
      return { gain: param(), connect: (n: unknown) => n };
    }
  }
  vi.stubGlobal('AudioContext', FakeAudioContext);
  return created;
}

const KINDS: readonly SoundKind[] = ['strike', 'hit', 'frame', 'pocket', 'turn'];

describe('sound', () => {
  beforeEach(() => resetAudioForTests());
  afterEach(() => {
    vi.unstubAllGlobals();
    store.dispatch(setVolume(0.8));
  });

  it('UI-7 playSound with volume 0 makes no audio node', () => {
    const created = mockAudio();
    store.dispatch(setVolume(0));
    for (const kind of KINDS) playSound(kind, 1);
    expect(created).toEqual({ ctx: 0, osc: 0, gain: 0, noise: 0, filter: 0 });
  });

  it('UI-7 with volume up each kind makes nodes; strength 0 makes none', () => {
    const created = mockAudio();
    store.dispatch(setVolume(0.5));
    playSound('hit', 0);
    expect(created.osc + created.noise).toBe(0);
    playSound('hit', 0.7);
    playSound('turn');
    expect(created.ctx).toBe(1);
    expect(created.osc).toBeGreaterThan(0);
    expect(created.gain).toBe(created.osc + created.noise);
  });

  it('UI-7 table sounds have a filtered noise contact, the turn cue is pure tones', () => {
    for (const kind of KINDS) {
      resetAudioForTests();
      const created = mockAudio();
      playSound(kind, 1);
      if (kind === 'turn') expect(created.noise).toBe(0);
      else expect(created.noise).toBeGreaterThan(0);
      expect(created.filter).toBe(created.noise);
      vi.unstubAllGlobals();
    }
  });
});
