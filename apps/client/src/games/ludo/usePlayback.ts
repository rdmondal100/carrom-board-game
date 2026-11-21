import { useCallback, useEffect, useRef, useState } from 'react';
import type { LudoEvent } from '@hub/ludo';
import { haptic } from '@/lib/native';
import { playSound } from '@/lib/sound';
import { framesFor, type Frame } from './playback';

/** Sounds for a frame's cue (Web Audio kinds shared with carrom). */
function cueSound(cue: Frame['cue']): void {
  if (cue === 'roll') playSound('frame', 0.6);
  else if (cue === 'hop') playSound('hit', 0.25);
  else if (cue === 'capture') {
    playSound('pocket');
    haptic('pocket');
  } else if (cue === 'home') playSound('pocket', 0.7);
}

interface Job { frames: Frame[]; onDone?: () => void }

/** The frame loop, outside React: shows each frame of the first job, then the next job, until none are left. */
interface Player {
  queue: Job[];
  timer: ReturnType<typeof setTimeout> | null;
  running: boolean;
  show: (f: Frame | null) => void;
  setBusy: (b: boolean) => void;
}

function pump(p: Player): void {
  const job = p.queue[0];
  if (!job) {
    p.running = false;
    p.setBusy(false);
    p.show(null);
    return;
  }
  const f = job.frames.shift();
  if (!f) {
    p.queue.shift();
    job.onDone?.();
    pump(p);
    return;
  }
  p.show(f);
  cueSound(f.cue);
  p.timer = setTimeout(() => pump(p), f.ms);
}

/**
 * LUDO-6 plays a move's frames one after another (die, hops, captures). While
 * it runs, `frame` is what the board shows; `onDone` fires after the last one.
 * Plays are queued, so moves arriving quickly still show in order.
 */
export function usePlayback(): {
  frame: Frame | null;
  busy: boolean;
  play: (start: readonly (readonly number[])[], events: readonly LudoEvent[], onDone?: () => void) => void;
} {
  const [frame, setFrame] = useState<Frame | null>(null);
  const [busy, setBusy] = useState(false);
  const player = useRef<Player>({ queue: [], timer: null, running: false, show: setFrame, setBusy });

  const play = useCallback((start: readonly (readonly number[])[], events: readonly LudoEvent[], onDone?: () => void) => {
    const p = player.current;
    p.queue.push({ frames: framesFor(start, events), onDone });
    if (p.running) return;
    p.running = true;
    p.setBusy(true);
    pump(p);
  }, []);

  useEffect(() => {
    const p = player.current;
    return () => {
      if (p.timer) clearTimeout(p.timer);
      p.queue = [];
      p.running = false;
    };
  }, []);

  return { frame, busy, play };
}
