import { store } from '@/store/store';

export type SoundKind = 'hit' | 'frame' | 'pocket' | 'turn';

/** One oscillator sweep; times in seconds from the sound's start. */
interface Sweep { wave: OscillatorType; from: number; to: number; at: number; dur: number; gain: number }

// UI-7: every sound is a few short synthesized tones, no audio files.
const TONES: Record<SoundKind, readonly Sweep[]> = {
  /** Wood on wood: a sharp, quick click. */
  hit: [
    { wave: 'triangle', from: 1400, to: 700, at: 0, dur: 0.035, gain: 0.9 },
    { wave: 'sine', from: 420, to: 260, at: 0, dur: 0.05, gain: 0.5 },
  ],
  /** Coin against the frame: a low thud. */
  frame: [{ wave: 'sine', from: 190, to: 85, at: 0, dur: 0.09, gain: 0.9 }],
  /** Coin dropping into a pocket: a falling "plop". */
  pocket: [
    { wave: 'sine', from: 520, to: 150, at: 0, dur: 0.16, gain: 0.8 },
    { wave: 'sine', from: 140, to: 70, at: 0.06, dur: 0.14, gain: 0.5 },
  ],
  /** Turn change: two soft rising notes. */
  turn: [
    { wave: 'sine', from: 660, to: 660, at: 0, dur: 0.11, gain: 0.35 },
    { wave: 'sine', from: 880, to: 880, at: 0.1, dur: 0.14, gain: 0.35 },
  ],
};

/** Ramps can't reach 0; this is "silent" for an exponential fade. */
const SILENT = 0.0001;
/** Fade-in time so tones start without a click, seconds. */
const ATTACK_S = 0.004;
/** How long to buzz on a pocket when haptics are on, ms. */
export const POCKET_BUZZ_MS = 25;

type AudioCtor = typeof AudioContext;
let ctx: AudioContext | null = null;

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

/** For tests: forget the shared AudioContext. */
export function resetAudioForTests(): void {
  ctx = null;
}

const clamp01 = (v: number): number => Math.max(0, Math.min(1, v));

/**
 * UI-7: play a short synthesized sound. `strength` (0–1) scales loudness, so a
 * hard hit is louder than a touch. Volume comes from settings; at volume 0 no
 * audio node is made at all.
 */
export function playSound(kind: SoundKind, strength = 1): void {
  const level = clamp01(store.getState().settings.volume) * clamp01(strength);
  if (level <= 0) return;
  const ac = audio();
  if (!ac) return;
  const t0 = ac.currentTime;
  for (const p of TONES[kind]) {
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    const start = t0 + p.at;
    const end = start + p.dur;
    osc.type = p.wave;
    osc.frequency.setValueAtTime(p.from, start);
    if (p.to !== p.from) osc.frequency.exponentialRampToValueAtTime(p.to, end);
    gain.gain.setValueAtTime(SILENT, start);
    gain.gain.exponentialRampToValueAtTime(Math.max(SILENT, p.gain * level), start + ATTACK_S);
    gain.gain.exponentialRampToValueAtTime(SILENT, end);
    osc.connect(gain).connect(ac.destination);
    osc.start(start);
    osc.stop(end);
  }
}

/** A short vibration when haptics are on and the device supports it. */
export function buzz(ms: number): void {
  if (!store.getState().settings.haptics) return;
  try {
    navigator.vibrate?.(ms);
  } catch {
    // Some browsers throw without a user gesture; haptics are optional.
  }
}
