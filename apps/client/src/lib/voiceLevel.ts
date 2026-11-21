/**
 * VOICE-5 speaking rings: a WebAudio level meter per stream. Every
 * LEVEL_TICK_MS it measures each stream's loudness and reports the ids above
 * the threshold, but only when that set changes (no per-frame React work).
 */

export const LEVEL_TICK_MS = 120;
/** RMS of the time-domain signal (0–1) that counts as speaking. */
export const SPEAKING_RMS = 0.03;
const FFT_SIZE = 512;
const MID = 128;

export interface LevelMeter {
  add(id: string, stream: MediaStream): void;
  remove(id: string): void;
  close(): void;
}

interface Node { src: MediaStreamAudioSourceNode; analyser: AnalyserNode; buf: Uint8Array<ArrayBuffer> }

type Ctx = typeof AudioContext;
const audioContextClass = (): Ctx | null =>
  (globalThis as { AudioContext?: Ctx; webkitAudioContext?: Ctx }).AudioContext
  ?? (globalThis as { webkitAudioContext?: Ctx }).webkitAudioContext ?? null;

/** RMS of 8-bit time-domain samples centred on 128. */
export function rms(buf: Uint8Array): number {
  if (buf.length === 0) return 0;
  let sum = 0;
  for (const v of buf) {
    const x = (v - MID) / MID;
    sum += x * x;
  }
  return Math.sqrt(sum / buf.length);
}

const sameIds = (a: readonly string[], b: readonly string[]) => a.length === b.length && a.every((x, i) => x === b[i]);

/** A meter that calls `onSpeaking` with the sorted ids now speaking. No WebAudio = no rings, nothing breaks. */
export function createLevelMeter(onSpeaking: (ids: string[]) => void): LevelMeter {
  const Ctor = audioContextClass();
  let ctx: AudioContext | null = null;
  const nodes = new Map<string, Node>();
  let timer: ReturnType<typeof setInterval> | null = null;
  let last: string[] = [];

  const tick = () => {
    const now: string[] = [];
    for (const [id, n] of nodes) {
      n.analyser.getByteTimeDomainData(n.buf);
      if (rms(n.buf) > SPEAKING_RMS) now.push(id);
    }
    now.sort();
    if (!sameIds(now, last)) {
      last = now;
      onSpeaking(now);
    }
  };

  const remove = (id: string) => {
    const n = nodes.get(id);
    if (!n) return;
    n.src.disconnect();
    nodes.delete(id);
    if (nodes.size === 0 && timer !== null) {
      clearInterval(timer);
      timer = null;
      if (last.length > 0) onSpeaking((last = []));
    }
  };

  return {
    add(id, stream) {
      if (!Ctor) return;
      remove(id);
      try {
        ctx ??= new Ctor();
        if (ctx.state === 'suspended') void ctx.resume().catch(() => {});
        const src = ctx.createMediaStreamSource(stream);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = FFT_SIZE;
        src.connect(analyser);
        nodes.set(id, { src, analyser, buf: new Uint8Array(new ArrayBuffer(analyser.fftSize)) });
        timer ??= setInterval(tick, LEVEL_TICK_MS);
      } catch {
        // A stream without audio, or WebAudio refused: no ring for this one.
      }
    },
    remove,
    close() {
      for (const id of [...nodes.keys()]) remove(id);
      void ctx?.close().catch(() => {});
      ctx = null;
    },
  };
}
