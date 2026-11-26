import { afterAll, beforeAll, beforeEach, describe, expect, inject, it } from 'vitest';
import { dailyMissions, levelStart, missionTiers, PROGRESS, type Mission } from '@carrom/protocol';
import { GAME_IDS } from '@hub/game-kit';
import { connectDb, disconnectDb } from '../connectDb.js';
import { User } from '../models/user.model.js';
import { dayKey, ECONOMY } from './economyConfig.js';
import { claimStreak, grantXp, recordGame, streakView } from './progress.js';
import { claimBotReward, rewardOnlineGame } from './wallet.js';

const pool = new Map(missionTiers(GAME_IDS).flat().map((m) => [m.id, m]));
const mission = (id: string, target?: number): Mission => ({ ...pool.get(id)!, ...(target ? { target } : {}) });

async function player(over: Record<string, unknown> = {}) {
  const u = await User.create({ name: 'Rina', ...over });
  return u.id as string;
}

/** Give `id` exactly these missions for today. */
async function setMissions(id: string, list: Mission[], day = dayKey(new Date())) {
  await User.updateOne({ _id: id }, { $set: { missions: { day, swaps: 0, list: list.map((m) => ({ ...m, progress: 0, seen: [], claimed: false })) } } });
}

async function progressOf(id: string): Promise<Record<string, number>> {
  const u = (await User.findById(id).lean())!;
  return Object.fromEntries(u.missions!.list.map((m) => [m.id, m.kind === 'variety' ? m.seen.length : m.progress]));
}

const at = (day: string) => new Date(`${day}T10:00:00.000Z`);

describe('progress', () => {
  beforeAll(async () => {
    await connectDb(inject('mongoUri'));
  });
  beforeEach(async () => {
    await User.deleteMany({});
  });
  afterAll(async () => {
    await disconnectDb();
  });

  describe('PRG-1 XP and levels', () => {
    it('PRG-1 XP across a level pays the level-up coins once; two levels pay twice', async () => {
      const id = await player({ xp: 90 });
      expect(await grantXp(id, 5)).toEqual({ xp: 5, levelCoins: 0 });
      expect(await grantXp(id, 10)).toEqual({ xp: 10, level: 2, levelCoins: PROGRESS.levelUpCoins });
      const jump = await grantXp(id, levelStart(4) - 105);
      expect(jump).toMatchObject({ level: 4, levelCoins: 2 * PROGRESS.levelUpCoins });
      expect((await User.findById(id))!.coins).toBe(3 * PROGRESS.levelUpCoins);
    });

    it('PRG-1 parallel XP grants never pay a level twice', async () => {
      const id = await player({ xp: 60 });
      await Promise.all(Array.from({ length: 8 }, () => grantXp(id, 10)));
      const u = (await User.findById(id))!;
      expect(u.xp).toBe(140);
      expect(u.coins).toBe(PROGRESS.levelUpCoins);
    });
  });

  describe('PRG-3 games move missions', () => {
    it('PRG-3 a game counts for the missions it fits; variety counts distinct games', async () => {
      const id = await player();
      await setMissions(id, [mission('play-any'), mission('win-ludo'), mission('online-any'), mission('variety-any')]);
      await recordGame(id, { game: 'ludo', won: true, online: false });
      expect(await progressOf(id)).toEqual({ 'play-any': 1, 'win-ludo': 1, 'online-any': 0, 'variety-any': 1 });
      await recordGame(id, { game: 'carrom', won: false, online: true });
      await recordGame(id, { game: 'carrom', won: true, online: true });
      expect(await progressOf(id)).toEqual({ 'play-any': 3, 'win-ludo': 1, 'online-any': 2, 'variety-any': 2 });
      expect((await User.findById(id))!.xp).toBe(2 * PROGRESS.gameXp.win + PROGRESS.gameXp.loss);
    });

    it('PRG-3 online game: the winner\'s win missions move, the loser\'s don\'t; only that game\'s missions', async () => {
      const a = await player();
      const b = await player();
      for (const id of [a, b]) await setMissions(id, [mission('win-any'), mission('play-carrom'), mission('play-ludo')]);
      const given = await rewardOnlineGame([{ userId: a, won: true }, { userId: b, won: false }], 'ludo');
      expect(given.get(a)).toEqual({ coins: ECONOMY.win, xp: PROGRESS.gameXp.win, levelCoins: 0 });
      expect(given.get(b)).toEqual({ coins: ECONOMY.loss, xp: PROGRESS.gameXp.loss, levelCoins: 0 });
      expect(await progressOf(a)).toEqual({ 'win-any': 1, 'play-carrom': 0, 'play-ludo': 1 });
      expect(await progressOf(b)).toEqual({ 'win-any': 0, 'play-carrom': 0, 'play-ludo': 1 });
    });

    it('PRG-3 a Vs-bot game counts only when rewarded: the 6th game of a day moves nothing', async () => {
      const id = await player();
      await setMissions(id, [mission('play-any', 10), mission('play-ludo', 10), mission('online-any')]);
      const results = [];
      for (let i = 0; i < ECONOMY.botGamesPerDay + 1; i++) results.push(await claimBotReward(id, false, 'ludo'));
      expect(results.at(-1)).toEqual({ coins: 0, xp: 0, levelCoins: 0 });
      expect(await progressOf(id)).toEqual({ 'play-any': ECONOMY.botGamesPerDay, 'play-ludo': ECONOMY.botGamesPerDay, 'online-any': 0 });
    });

    it('PRG-3 yesterday\'s missions are replaced on a new day', async () => {
      const id = await player();
      await setMissions(id, [mission('play-any')], '2000-01-01');
      await User.updateOne({ _id: id }, { $set: { 'missions.list.0.progress': 2, 'missions.swaps': 1 } });
      await recordGame(id, { game: 'carrom', won: true, online: false });
      const u = (await User.findById(id).lean())!;
      const today = dayKey(new Date());
      expect(u.missions!.day).toBe(today);
      expect(u.missions!.swaps).toBe(0);
      expect(u.missions!.list.map((m) => m.id)).toEqual(dailyMissions(id, today, GAME_IDS).map((m) => m.id));
      expect(u.missions!.list.every((m) => m.progress <= 1)).toBe(true);
    });
  });

  describe('PRG-6 login streak', () => {
    it('PRG-6 day 1 20; next day 30; same day 0; a missed day starts again at 20', async () => {
      const id = await player();
      expect(await claimStreak(id, at('2026-11-01'))).toEqual({ coins: 20, streak: 1 });
      expect(await claimStreak(id, at('2026-11-02'))).toEqual({ coins: 30, streak: 2 });
      expect(await claimStreak(id, at('2026-11-02'))).toEqual({ coins: 0, streak: 0 });
      expect(await claimStreak(id, at('2026-11-04'))).toEqual({ coins: 20, streak: 1 });
      expect((await User.findById(id))!.coins).toBe(70);
    });

    it('PRG-6 a full week pays every day, then day 8 pays day 1 again', async () => {
      const id = await player();
      const paid = [];
      for (let d = 1; d <= 9; d++) paid.push((await claimStreak(id, at(`2026-11-0${d}`))).coins);
      expect(paid).toEqual([...PROGRESS.streakCoins, PROGRESS.streakCoins[0], PROGRESS.streakCoins[1]]);
      expect((await User.findById(id))!.coins).toBe(paid.reduce((a, b) => a + b, 0));
    });

    it('PRG-6 parallel claims pay once', async () => {
      const id = await player({ dailyBonusDay: '2026-11-01', streak: 3 });
      const all = await Promise.all(Array.from({ length: 5 }, () => claimStreak(id, at('2026-11-02'))));
      expect(all.filter((r) => r.coins > 0)).toEqual([{ coins: PROGRESS.streakCoins[3], streak: 4 }]);
      expect((await User.findById(id))!.coins).toBe(PROGRESS.streakCoins[3]);
    });

    it('PRG-6 the view: broken after a missed day, today lit', async () => {
      expect(streakView({ dailyBonusDay: '2026-11-02', streak: 2 }, at('2026-11-02'))).toEqual({ count: 2, day: 2, claimedToday: true });
      expect(streakView({ dailyBonusDay: '2026-11-02', streak: 2 }, at('2026-11-03'))).toEqual({ count: 2, day: 3, claimedToday: false });
      expect(streakView({ dailyBonusDay: '2026-11-02', streak: 2 }, at('2026-11-05'))).toEqual({ count: 0, day: 1, claimedToday: false });
    });
  });
});
