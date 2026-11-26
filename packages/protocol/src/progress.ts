/**
 * PRG-1..6 (spec 24): levels, daily missions and the login streak. Pure data and
 * functions shared by the server (which decides) and the client (which shows).
 * Rewards are coins and XP only: nothing here changes how a game plays.
 */

export const PROGRESS = {
  /** PRG-1 XP for a rewarded game. */
  gameXp: { win: 30, loss: 15 },
  /** PRG-1 coins for each level reached. */
  levelUpCoins: 50,
  /** PRG-6 coins for streak days 1..7; day 8 starts the week again. */
  streakCoins: [20, 30, 40, 50, 60, 80, 150],
  /** PRG-5 mission swaps per UTC day. */
  swapsPerDay: 1,
  /** Levels stop here (keeps levelOf bounded). */
  maxLevel: 999,
} as const;

export type MissionKind = 'play' | 'win' | 'online' | 'variety';

/** PRG-2 one daily mission. `game` null = any game. `id` is unique within a day's list. */
export interface Mission {
  id: string;
  kind: MissionKind;
  game: string | null;
  target: number;
  coins: number;
  xp: number;
}

/** PRG-7 a mission as the client sees it: `progress` is capped at `target`. */
export interface MissionView extends Mission { progress: number; claimed: boolean }

/** PRG-3 what one rewarded game was: which game, won or not, online or Vs bot. */
export interface GameOutcome { game: string; won: boolean; online: boolean }

// ---- levels (PRG-1) --------------------------------------------------------

/** XP it takes to go from `level` to the next one. */
export function levelNeed(level: number): number {
  return 100 + 50 * (level - 1);
}

/** Total XP at which `level` begins (level 1 = 0). */
export function levelStart(level: number): number {
  const n = Math.max(0, level - 1);
  return 100 * n + 25 * n * (n - 1);
}

/** The level a player with `xp` total XP is at. */
export function levelOf(xp: number): number {
  let level = 1;
  while (level < PROGRESS.maxLevel && levelStart(level + 1) <= xp) level++;
  return level;
}

// ---- missions (PRG-2, PRG-3, PRG-5) ---------------------------------------

function mission(kind: MissionKind, game: string | null, target: number, coins: number, xp: number): Mission {
  return { id: `${kind}-${game ?? 'any'}`, kind, game, target, coins, xp };
}

/** PRG-2 the pool in tiers: easy (play), medium (win), social (online, variety). Built from the game ids. */
export function missionTiers(games: readonly string[]): Mission[][] {
  return [
    [mission('play', null, 3, 40, 30), ...games.map((g) => mission('play', g, 2, 40, 30))],
    [mission('win', null, 2, 60, 40), ...games.map((g) => mission('win', g, 1, 50, 40))],
    [mission('online', null, 2, 60, 50), mission('variety', null, 2, 60, 50)],
  ];
}

/** FNV-1a 32-bit: a stable, unsigned hash of a string. */
export function hash32(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** PRG-2 a player's missions for one UTC day: one per tier, the same every time it's asked. */
export function dailyMissions(userId: string, day: string, games: readonly string[]): Mission[] {
  return missionTiers(games).map((tier, t) => tier[hash32(`${userId}|${day}|${t}`) % tier.length]!);
}

/**
 * PRG-5 a replacement for `list[index]`: another mission of the same tier that is
 * not in the list (`salt` = swaps already used today). Null when there is none.
 */
export function swapPick(
  list: readonly Mission[], index: number, userId: string, day: string, games: readonly string[], salt: number,
): Mission | null {
  const old = list[index];
  if (!old) return null;
  const tiers = missionTiers(games);
  const tier = tiers.find((ms) => ms.some((m) => m.id === old.id)) ?? tiers.flat();
  const taken = new Set(list.map((m) => m.id));
  const options = tier.filter((m) => !taken.has(m.id));
  if (options.length === 0) return null;
  return options[hash32(`${userId}|${day}|swap|${salt}`) % options.length]!;
}

/** PRG-3 does this game count for the mission? (variety counts every game; the server keeps distinct ids.) */
export function missionCounts(m: Pick<Mission, 'kind' | 'game'>, r: GameOutcome): boolean {
  const gameFits = m.game === null || m.game === r.game;
  switch (m.kind) {
    case 'play': return gameFits;
    case 'win': return r.won && gameFits;
    case 'online': return r.online;
    case 'variety': return true;
  }
}

// ---- streak (PRG-6) --------------------------------------------------------

/** The streak week's day (1..7) for a streak of `count` days (count ≥ 1). */
export function streakDay(count: number): number {
  return ((Math.max(1, count) - 1) % PROGRESS.streakCoins.length) + 1;
}

/** PRG-6 coins for the claim that makes the streak `count` days long (0 when count < 1). */
export function streakReward(count: number): number {
  return count < 1 ? 0 : PROGRESS.streakCoins[streakDay(count) - 1]!;
}
