import { store } from '@/store/store';

export type SoundKind = 'strike' | 'hit' | 'frame' | 'pocket' | 'turn';

/**
 * One layer of a sound; times in seconds from the sound's start. A `tone` is a
 * damped resonance (a mode of the wood ringing); a `noise` layer is a filtered
 * burst (the contact itself: clicks, thuds, the net, powder under the striker).
 */
type Layer =
  | { type: 'tone'; wave: OscillatorType; from: number; to: number; at: number; dur: number; gain: number }
  | { type: 'noise'; filter: BiquadFilterType; freq: number; q: number; at: number; dur: number; gain: number };

// UI-7: every sound is synthesized (no audio files), modelled on the real thing.
const LAYERS: Record<SoundKind, readonly Layer[]> = {
  /** Finger flicks the striker: a nail snap, the finger's soft thump, then the striker hissing over powder. */
  strike: [
    { type: 'noise', filter: 'highpass', freq: 2600, q: 0.7, at: 0, dur: 0.014, gain: 0.9 },
    { type: 'tone', wave: 'sine', from: 330, to: 230, at: 0, dur: 0.045, gain: 0.45 },
    { type: 'noise', filter: 'bandpass', freq: 5200, q: 0.6, at: 0.006, dur: 0.24, gain: 0.07 },
  ],
  /** Lacquered coin on coin: a hard, bright "tak" with a short wooden ring. */
  hit: [
    { type: 'noise', filter: 'bandpass', freq: 3300, q: 1.3, at: 0, dur: 0.022, gain: 0.95 },
    { type: 'tone', wave: 'sine', from: 2350, to: 2200, at: 0, dur: 0.05, gain: 0.32 },
    { type: 'tone', wave: 'sine', from: 3950, to: 3850, at: 0, dur: 0.03, gain: 0.18 },
    { type: 'tone', wave: 'triangle', from: 950, to: 720, at: 0, dur: 0.022, gain: 0.25 },
  ],
  /** Coin into the cushioned hardwood rail: a dull, low "thock". */
  frame: [
    { type: 'noise', filter: 'lowpass', freq: 950, q: 0.7, at: 0, dur: 0.05, gain: 0.85 },
    { type: 'tone', wave: 'sine', from: 210, to: 145, at: 0, dur: 0.13, gain: 0.7 },
    { type: 'tone', wave: 'sine', from: 540, to: 480, at: 0, dur: 0.05, gain: 0.22 },
  ],
  /** Coin drops into a pocket: a tick on the rim, a thump into the net, the net's rustle, a clink on the coins below. */
  pocket: [
    { type: 'noise', filter: 'bandpass', freq: 1900, q: 0.9, at: 0, dur: 0.028, gain: 0.5 },
    { type: 'tone', wave: 'sine', from: 170, to: 80, at: 0.02, dur: 0.17, gain: 0.75 },
    { type: 'noise', filter: 'bandpass', freq: 700, q: 0.6, at: 0.03, dur: 0.2, gain: 0.35 },
    { type: 'noise', filter: 'bandpass', freq: 2700, q: 3, at: 0.095, dur: 0.022, gain: 0.28 },
    { type: 'tone', wave: 'sine', from: 2500, to: 2450, at: 0.095, dur: 0.035, gain: 0.12 },
  ],
  /** Turn change: two soft rising notes (a UI cue, not a table sound). */
  turn: [
    { type: 'tone', wave: 'sine', from: 660, to: 660, at: 0, dur: 0.11, gain: 0.35 },
    { type: 'tone', wave: 'sine', from: 880, to: 880, at: 0.1, dur: 0.14, gain: 0.35 },
  ],
};

/** Ramps can't reach 0; this is "silent" for an exponential fade. */
const SILENT = 0.0001;
/** Fade-in time so layers start without a click, seconds. */
const ATTACK_S = 0.0015;
/** Each play is pitched up or down by up to this share, so repeated hits don't sound machine-made. */
const PITCH_SPREAD = 0.06;
/** A soft touch sounds duller: filters open from this share of their frequency at strength 0. */
const DULL_SOFT = 0.55;
/** Length of the shared noise buffer, seconds. */
const NOISE_S = 1;

type AudioCtor = typeof AudioContext;
let ctx: AudioContext | null = null;
let noise: AudioBuffer | null = null;

function audio(): AudioContext | null {
  if (!ctx) {
    const w = window as unknown as { AudioContext?: AudioCtor; webkitAudioContext?: AudioCtor };
    const Ctor = w.AudioContext ?? w.webkitAudioContext;
    if (!Ctor) return null;
    try {
      ctx = new Ctor();
    } catch {
      return null;
    }
  }
  // Browsers start audio suspended until a user gesture; shots are gestures.
  if (ctx.state === 'suspended') void ctx.resume().catch(() => {});
  return ctx;
}

/** One second of white noise, made once per AudioContext. */
function noiseBuffer(ac: AudioContext): AudioBuffer {
  if (!noise) {
    const n = Math.floor(ac.sampleRate * NOISE_S);
    noise = ac.createBuffer(1, n, ac.sampleRate);
    const data = noise.getChannelData(0);
    for (let i = 0; i < n; i++) data[i] = Math.random() * 2 - 1;
  }
  return noise;
}

/** For tests: forget the shared AudioContext. */
export function resetAudioForTests(): void {
  ctx = null;
  noise = null;
}

const clamp01 = (v: number): number => Math.max(0, Math.min(1, v));

/** A gain node that jumps to `peak` and decays exponentially over `dur`. */
function envelope(ac: AudioContext, start: number, dur: number, peak: number): GainNode {
  const gain = ac.createGain();
  gain.gain.setValueAtTime(SILENT, start);
  gain.gain.exponentialRampToValueAtTime(Math.max(SILENT, peak), start + ATTACK_S);
  gain.gain.exponentialRampToValueAtTime(SILENT, start + ATTACK_S + dur);
  return gain;
}

/**
 * UI-7: play a short synthesized sound. `strength` (0–1) scales loudness and
 * brightness, so a hard hit is louder and sharper than a touch. Volume comes
 * from settings; at volume 0 no audio node is made at all.
 */
export function playSound(kind: SoundKind, strength = 1): void {
  const s = clamp01(strength);
  const level = clamp01(store.getState().settings.volume) * s;
  if (level <= 0) return;
  const ac = audio();
  if (!ac) return;
  const t0 = ac.currentTime;
  const pitch = kind === 'turn' ? 1 : 1 + (Math.random() * 2 - 1) * PITCH_SPREAD;
  const bright = DULL_SOFT + (1 - DULL_SOFT) * s;
  for (const p of LAYERS[kind]) {
    const start = t0 + p.at;
    const end = start + ATTACK_S + p.dur;
    const gain = envelope(ac, start, p.dur, p.gain * level);
    if (p.type === 'tone') {
      const osc = ac.createOscillator();
      osc.type = p.wave;
      osc.frequency.setValueAtTime(p.from * pitch, start);
      if (p.to !== p.from) osc.frequency.exponentialRampToValueAtTime(p.to * pitch, end);
      osc.connect(gain).connect(ac.destination);
      osc.start(start);
      osc.stop(end);
    } else {
      const src = ac.createBufferSource();
      src.buffer = noiseBuffer(ac);
      const filter = ac.createBiquadFilter();
      filter.type = p.filter;
      filter.frequency.setValueAtTime(p.freq * pitch * bright, start);
      filter.Q.setValueAtTime(p.q, start);
      src.connect(filter).connect(gain).connect(ac.destination);
      src.start(start, Math.random() * (NOISE_S - p.dur - ATTACK_S));
      src.stop(end);
    }
  }
}
