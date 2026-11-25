import { useCallback, useEffect, useRef, useState } from 'react';
import type { CallbreakEvent, CallbreakView } from '@hub/callbreak';
import { haptic } from '@/lib/native';
import { playSound } from '@/lib/sound';
import { framesFor, type Frame } from './playback';

function cueSound(f: Frame, me: number | null): void {
  if (f.cue === 'deal') playSound('frame', 0.5);
  else if (f.cue === 'card') playSound('hit', 0.3);
  else if (f.cue === 'trick' && f.winner === me) {
    playSound('pocket', 0.6);
    haptic('pocket');
  }
}

interface Job { frames: Frame[]; me: number | null; onDone?: () => void }
interface Player { queue: Job[]; running: boolean; timer: ReturnType<typeof setTimeout> | null; shown: Frame | null; show: (f: Frame | null) => void; setBusy: (b: boolean) => void }

/** Shows each frame of the first job, then the next job, until none are left (outside React state per frame). */
function pump(p: Player): void {
  const job = p.queue[0];
  if (!job) {
    p.running = false;
    p.timer = null;
    p.shown = null;
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
  p.shown = f;
  p.show(f);
  cueSound(f, job.me);
  p.timer = setTimeout(() => pump(p), f.ms);
}

/**
 * CB-7 plays a change's frames one after another (deal, calls, cards, the
 * trick going to its winner, the round's points). While it runs, `frame` is
 * what the table shows; `onDone` fires after the last one. Plays queue up.
 */
export function useFrames(): {
  frame: Frame | null;
  busy: boolean;
  play: (start: CallbreakView, events: readonly CallbreakEvent[], end: CallbreakView, onDone?: () => void) => void;
} {
  const [frame, setFrame] = useState<Frame | null>(null);
  const [busy, setBusy] = useState(false);
  const player = useRef<Player>({ queue: [], running: false, timer: null, shown: null, show: setFrame, setBusy });

  const play = useCallback((start: CallbreakView, events: readonly CallbreakEvent[], end: CallbreakView, onDone?: () => void) => {
    const p = player.current;
    p.queue.push({ frames: framesFor(start, events, end), me: start.seat, onDone });
    if (p.running) return;
    p.running = true;
    p.setBusy(true);
    pump(p);
  }, []);

  // Pause on unmount, resume on (re)mount. StrictMode mounts twice in dev; dropping
  // the queue there left `busy` stuck on, so the game never took input again.
  useEffect(() => {
    const p = player.current;
    if (!p.running && p.queue.length > 0) {
      p.running = true;
      pump(p);
    }
    return () => {
      if (p.timer) {
        clearTimeout(p.timer);
        if (p.shown) p.queue[0]?.frames.unshift(p.shown);
      }
      p.timer = null;
      p.running = false;
    };
  }, []);

  return { frame, busy, play };
}
