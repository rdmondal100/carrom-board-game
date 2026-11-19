import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setVolume } from '@/store/settingsSlice';
import { store } from '@/store/store';
import { playSound, resetAudioForTests } from './sound';

const param = () => ({ setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() });

function mockAudio() {
  const created = { ctx: 0, osc: 0, gain: 0 };
  class FakeAudioContext {
    currentTime = 0;
    state = 'running';
    destination = {};
    constructor() { created.ctx += 1; }
    resume() { return Promise.resolve(); }
    createOscillator() {
      created.osc += 1;
      return { type: 'sine', frequency: param(), connect: (n: unknown) => n, start: vi.fn(), stop: vi.fn() };
    }
    createGain() {
      created.gain += 1;
      return { gain: param(), connect: (n: unknown) => n };
    }
  }
  vi.stubGlobal('AudioContext', FakeAudioContext);
  return created;
}

describe('sound', () => {
  beforeEach(() => resetAudioForTests());
  afterEach(() => {
    vi.unstubAllGlobals();
    store.dispatch(setVolume(0.8));
  });

  it('UI-7 playSound with volume 0 makes no audio node', () => {
    const created = mockAudio();
    store.dispatch(setVolume(0));
    for (const kind of ['hit', 'frame', 'pocket', 'turn'] as const) playSound(kind, 1);
    expect(created).toEqual({ ctx: 0, osc: 0, gain: 0 });
  });

  it('UI-7 with volume up each kind makes oscillators; strength 0 makes none', () => {
    const created = mockAudio();
    store.dispatch(setVolume(0.5));
    playSound('hit', 0);
    expect(created.osc).toBe(0);
    playSound('hit', 0.7);
    playSound('turn');
    expect(created.ctx).toBe(1);
    expect(created.osc).toBeGreaterThan(0);
    expect(created.gain).toBe(created.osc);
  });
});
