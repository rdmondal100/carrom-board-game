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
interface Player { queue: Job[]; running: boolean; timer: ReturnType<typeof setTimeout> | null; show: (f: Frame | null) => void; setBusy: (b: boolean) => void }

/** Shows each frame of the first job, then the next job, until none are left (outside React state per frame). */
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
  const player = useRef<Player>({ queue: [], running: false, timer: null, show: setFrame, setBusy });

  const play = useCallback((start: CallbreakView, events: readonly CallbreakEvent[], end: CallbreakView, onDone?: () => void) => {
    const p = player.current;
    p.queue.push({ frames: framesFor(start, events, end), me: start.seat, onDone });
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
