import { describe, expect, it } from 'vitest';
import { needsNetwork } from './offline';

describe('offline', () => {
  it('APP-9 online entry screens need the network', () => {
    for (const p of ['/online', '/join/ABCD', '/ranked', '/leaderboard', '/login', '/register', '/shop']) expect(needsNetwork(p)).toBe(true);
  });

  it('APP-9 same-device, Vs-bot and menus work offline; a running room is left alone', () => {
    for (const p of ['/', '/play', '/local/setup', '/local/play', '/settings', '/how-to-play', '/online/lobby', '/online/game']) {
      expect(needsNetwork(p)).toBe(false);
    }
  });
});
