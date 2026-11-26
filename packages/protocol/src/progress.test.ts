import { describe, expect, it } from 'vitest';
import {
  dailyMissions, levelNeed, levelOf, levelStart, missionCounts, missionTiers, PROGRESS, streakDay, streakReward, swapPick,
} from './progress';

const GAMES = ['carrom', 'ludo', 'callbreak', 'nodipar'];

describe('levels', () => {
  it('PRG-1 level curve: 0→1, 99→1, 100→2, 249→2, 250→3', () => {
    expect([0, 99, 100, 249, 250, 449, 450].map(levelOf)).toEqual([1, 1, 2, 2, 3, 3, 4]);
  });

  it('PRG-1 levelStart inverts levelOf, and each level needs levelNeed XP', () => {
    for (let l = 1; l < 60; l++) {
      expect(levelOf(levelStart(l))).toBe(l);
      expect(levelOf(levelStart(l) - 1)).toBe(Math.max(1, l - 1));
      expect(levelStart(l + 1) - levelStart(l)).toBe(levelNeed(l));
    }
  });

  it('PRG-1 levels stop at maxLevel', () => {
    expect(levelOf(Number.MAX_SAFE_INTEGER)).toBe(PROGRESS.maxLevel);
  });
});

describe('daily missions', () => {
  it('PRG-2 same user and day → the same 3, one per tier, distinct ids', () => {
    const a = dailyMissions('u1', '2026-11-26', GAMES);
    expect(dailyMissions('u1', '2026-11-26', GAMES)).toEqual(a);
    expect(a).toHaveLength(3);
    const tiers = missionTiers(GAMES);
    a.forEach((m, i) => expect(tiers[i]!.map((x) => x.id)).toContain(m.id));
    expect(new Set(a.map((m) => m.id)).size).toBe(3);
  });

  it('PRG-2 another day (or user) gives other missions for some players', () => {
    const days = Array.from({ length: 10 }, (_, i) => `2026-12-${String(i + 1).padStart(2, '0')}`);
    const lists = new Set(days.map((d) => dailyMissions('u1', d, GAMES).map((m) => m.id).join()));
    expect(lists.size).toBeGreaterThan(1);
    const users = new Set(['a', 'b', 'c', 'd', 'e', 'f'].map((u) => dailyMissions(u, '2026-12-01', GAMES).map((m) => m.id).join()));
    expect(users.size).toBeGreaterThan(1);
  });

  it('PRG-2 a new game joins the pool by itself', () => {
    const ids = missionTiers([...GAMES, 'newgame']).flat().map((m) => m.id);
    expect(ids).toContain('play-newgame');
    expect(ids).toContain('win-newgame');
  });

  it('PRG-5 swap gives a same-tier mission not already in the list', () => {
    for (const user of ['a', 'b', 'c', 'd']) {
      const list = dailyMissions(user, '2026-11-26', GAMES);
      list.forEach((old, i) => {
        const next = swapPick(list, i, user, '2026-11-26', GAMES, 0)!;
        expect(next).not.toBeNull();
        expect(list.map((m) => m.id)).not.toContain(next.id);
        expect(missionTiers(GAMES)[i]!.map((m) => m.id)).toContain(next.id);
        expect(next.id).not.toBe(old.id);
      });
    }
    expect(swapPick(dailyMissions('a', 'd', GAMES), 5, 'a', 'd', GAMES, 0)).toBeNull();
  });

  it('PRG-3 which games count for which mission', () => {
    const pool = new Map(missionTiers(GAMES).flat().map((m) => [m.id, m]));
    const ids = ['play-any', 'play-ludo', 'play-carrom', 'win-any', 'win-ludo', 'win-carrom', 'online-any', 'variety-any'];
    const counts = (r: { game: string; won: boolean; online: boolean }) => ids.map((id) => missionCounts(pool.get(id)!, r));
    // A Vs-bot Ludo win.
    expect(counts({ game: 'ludo', won: true, online: false })).toEqual([true, true, false, true, true, false, false, true]);
    // An online carrom loss.
    expect(counts({ game: 'carrom', won: false, online: true })).toEqual([true, false, true, false, false, false, true, true]);
  });
});

describe('streak', () => {
  it('PRG-6 rewards climb over 7 days, then the week starts again', () => {
    expect([1, 2, 3, 4, 5, 6, 7, 8, 9, 14, 15].map(streakReward)).toEqual([20, 30, 40, 50, 60, 80, 150, 20, 30, 150, 20]);
    expect([1, 7, 8, 15].map(streakDay)).toEqual([1, 7, 1, 1]);
    expect(streakReward(0)).toBe(0);
  });
});
