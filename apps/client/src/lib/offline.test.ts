import { describe, expect, it } from 'vitest';
import { needsNetwork } from './offline';

describe('offline', () => {
  it('APP-9 online entry screens need the network', () => {
    for (const p of ['/g/carrom/online', '/join/ABCD', '/g/carrom/ranked', '/g/ludo/leaderboard', '/login', '/register', '/shop']) {
      expect(needsNetwork(p), p).toBe(true);
    }
  });

  it('APP-9 same-device, Vs-bot and menus work offline; a running room is left alone', () => {
    const game = ['/g/carrom/play', '/g/carrom/local/setup', '/g/carrom/local/play', '/g/carrom/how-to-play', '/g/carrom/online/lobby', '/g/carrom/online/game'];
    for (const p of ['/', '/settings', '/profile', ...game]) {
      expect(needsNetwork(p)).toBe(false);
    }
  });
});
