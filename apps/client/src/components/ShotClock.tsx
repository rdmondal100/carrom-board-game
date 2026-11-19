import { useEffect, useRef, useState } from 'react';
import { RULES } from '@carrom/rules';
import { CLOCK_LOW_FRACTION } from '@/constants/view';
import { t } from '@/i18n/t';

interface Props {
  /** Counts down only while true (paused during playback, dialogs and pause). */
  running: boolean;
  /** Fraction of time left, every frame (drawn as the ring on the board). */
  onTick: (fraction: number | null) => void;
  onExpire: () => void;
}

const MS_PER_S = 1000;

/**
 * LOC-5: RULES.SHOT_CLOCK_MS per shot. Time lives in a ref and goes to the
 * board every frame; React only re-renders once a second for the label.
 * Give it a new `key` for each shot so it starts again from full.
 */
export function ShotClock({ running, onTick, onExpire }: Props) {
  const left = useRef<number>(RULES.SHOT_CLOCK_MS);
  const [seconds, setSeconds] = useState(Math.ceil(RULES.SHOT_CLOCK_MS / MS_PER_S));
  const cb = useRef({ onTick, onExpire });
  useEffect(() => { cb.current = { onTick, onExpire }; });

  useEffect(() => {
    cb.current.onTick(left.current / RULES.SHOT_CLOCK_MS);
    if (!running) return;
    let last = performance.now();
    let raf = 0;
    const frame = (now: number) => {
      left.current = Math.max(0, left.current - (now - last));
      last = now;
      cb.current.onTick(left.current / RULES.SHOT_CLOCK_MS);
      setSeconds(Math.ceil(left.current / MS_PER_S));
      if (left.current <= 0) {
        cb.current.onExpire();
        return;
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [running]);

  useEffect(() => () => cb.current.onTick(null), []);

  return (
    <span className={`tabular-nums text-sm ${(seconds * MS_PER_S) / RULES.SHOT_CLOCK_MS <= CLOCK_LOW_FRACTION ? 'text-red-400 font-semibold' : 'opacity-80'}`}>
      {t('clock.label', { s: seconds })}
    </span>
  );
}
