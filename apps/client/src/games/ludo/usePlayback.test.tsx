import { StrictMode, useEffect, useRef } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen } from '@testing-library/react';
import { newLudo } from '@hub/ludo';
import { useFrames } from '@/games/callbreak/useFrames';
import { callbreakView, newCallbreak } from '@hub/callbreak';
import { usePlayback } from './usePlayback';

vi.mock('@/lib/sound', () => ({ playSound: () => {} }));

/** Plays the opening once (like LudoLocal), shows `busy`. */
function LudoProbe() {
  const { busy, play } = usePlayback();
  const opened = useRef(false);
  useEffect(() => {
    if (opened.current) return;
    opened.current = true;
    const s = newLudo({ preset: 'bd', players: 4, teams: false, quick: false, tapToRoll: false }, 3);
    play(s.tokens.map((l) => l.map(() => -1)), s.recent);
  }, [play]);
  return <p>{busy ? 'busy' : 'idle'}</p>;
}

/** Plays the first deal once (like CbLocal), shows `busy`. */
function CbProbe() {
  const { busy, play } = useFrames();
  const opened = useRef(false);
  useEffect(() => {
    if (opened.current) return;
    opened.current = true;
    const s = newCallbreak({ rounds: 3, redeal: true }, 5);
    play(callbreakView(s, 0), s.recent, callbreakView(s, 0));
  }, [play]);
  return <p>{busy ? 'busy' : 'idle'}</p>;
}

describe('playback hooks under StrictMode', () => {
  afterEach(() => { cleanup(); vi.useRealTimers(); });

  it.each([['ludo', LudoProbe], ['callbreak', CbProbe]])('LUDO-6 / CB-7 %s opening animation finishes (not stuck busy)', async (_name, Probe) => {
    vi.useFakeTimers();
    render(<StrictMode><Probe /></StrictMode>);
    expect(screen.getByText('busy')).toBeTruthy();
    await act(async () => { await vi.runAllTimersAsync(); });
    expect(screen.getByText('idle')).toBeTruthy();
  });
});
