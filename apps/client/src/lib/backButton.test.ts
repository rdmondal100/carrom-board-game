import { describe, expect, it } from 'vitest';
import { decideBack, isMatchPath, onPauseRequest, requestPause, type BackState } from './backButton';

const at = (path: string, more: Partial<BackState> = {}): BackState => ({ path, dialogOpen: false, canGoBack: true, ...more });

describe('backButton', () => {
  it('APP-3 in a match → pause menu (local and online)', () => {
    expect(decideBack(at('/local/play'))).toBe('pause');
    expect(decideBack(at('/online/game'))).toBe('pause');
    expect(decideBack(at('/local/play', { canGoBack: false }))).toBe('pause');
  });

  it('APP-3 an open dialog closes first (pause menu, confirms, exit question)', () => {
    expect(decideBack(at('/local/play', { dialogOpen: true }))).toBe('closeDialog');
    expect(decideBack(at('/settings', { dialogOpen: true }))).toBe('closeDialog');
    expect(decideBack(at('/', { dialogOpen: true }))).toBe('closeDialog');
  });

  it('APP-3 in menus → go back', () => {
    for (const p of ['/play', '/settings', '/how-to-play', '/local/setup', '/online', '/online/lobby', '/ranked', '/profile']) {
      expect(decideBack(at(p))).toBe('back');
    }
  });

  it('APP-3 a menu opened directly (no history) → Home', () => {
    expect(decideBack(at('/join/ABCD', { canGoBack: false }))).toBe('home');
  });

  it('APP-3 on Home → "exit?" confirm, even with history', () => {
    expect(decideBack(at('/'))).toBe('confirmExit');
    expect(decideBack(at('/', { canGoBack: false }))).toBe('confirmExit');
  });

  it('APP-3 match paths are exact', () => {
    expect(isMatchPath('/local/play')).toBe(true);
    expect(isMatchPath('/local/setup')).toBe(false);
    expect(isMatchPath('/online/lobby')).toBe(false);
  });

  it('APP-3 pause requests reach listeners until they unsubscribe', () => {
    let n = 0;
    const off = onPauseRequest(() => { n += 1; });
    requestPause();
    off();
    requestPause();
    expect(n).toBe(1);
  });
});
