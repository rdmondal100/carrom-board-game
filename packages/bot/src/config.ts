// Every bot constant lives here. Units follow the engine: board side L = 1.0.

export type BotLevel = 'easy' | 'medium' | 'hard';

export interface LevelConfig {
  /** Most shots simulated per move (BOT-4). */
  sims: number;
  /** Aim noise, degrees: documentation only, the bot uses AIM_NOISE_SIN. */
  aimNoiseDeg: number;
  /** sin(aimNoiseDeg), written out so the bot needs no trig at runtime. */
  aimNoiseSin: number;
  /** Power is multiplied by 1 ± up to this share. */
  powerNoise: number;
  /** Powers tried for every ghost-ball aim. */
  powers: readonly number[];
}

export const LEVELS: Record<BotLevel, LevelConfig> = {
  easy: {
    sims: 40, aimNoiseDeg: 3, aimNoiseSin: 0.05233595624, powerNoise: 0.10,
    powers: [0.2, 0.32, 0.5],
  },
  medium: {
    sims: 150, aimNoiseDeg: 1, aimNoiseSin: 0.01745240644, powerNoise: 0.04,
    powers: [0.16, 0.24, 0.34, 0.48],
  },
  hard: {
    sims: 400, aimNoiseDeg: 0.3, aimNoiseSin: 0.00523596383, powerNoise: 0.015,
    powers: [0.14, 0.19, 0.25, 0.32, 0.42, 0.55],
  },
};

export const BOT = {
  /** Evenly spaced striker spots tried along the baseline (plus straight-line spots). */
  X_STEPS: 7,
  /** Ghost-ball aims sharper than this (cos of the cut angle) are skipped. */
  MIN_CUT_COS: 0.25,
  /** Spread shots (no target), seat-relative unit directions × powers. */
  SPREAD_DIRS: [
    { x: 0, y: 1 },
    { x: 0.25881904510, y: 0.96592582629 }, // 15° right
    { x: -0.25881904510, y: 0.96592582629 }, // 15° left
  ] as readonly { x: number; y: number }[],
  SPREAD_POWERS: [0.6, 1.0] as readonly number[],
  /** A blocked path keeps its aim but ranks it this many times lower. */
  BLOCKED_PENALTY: 4,
  /**
   * The best few shots are re-run slightly off (aim ±, power ±) and judged by
   * the average, so a lucky hairline shot loses to one that works every time.
   * These re-runs come out of the level's sim budget.
   */
  ROBUST_TOP: 8,
  /**
   * Picking which shots get that re-run: score + this × the aim's rank, so a
   * clean ghost-ball pot is checked ahead of a lucky cut with the same score.
   */
  CLEAN_AIM: 40,
  /** Smallest aim change tried: sin 0.5°. The level's own noise is used when larger. */
  ROBUST_MIN_SIN: 0.00872653550,
  /** Smallest power change tried, as a share. */
  ROBUST_MIN_POWER: 0.03,
} as const;

/** BOT-3 score weights, from the shooter's side. */
export const WEIGHTS = {
  OWN_COIN: 100,
  OPP_COIN: -90,
  RED_COVERED: 160,
  /** Red down and waiting for cover on our next shot. */
  RED_PENDING: 40,
  RETURNED: -60,
  KEEP_TURN: 40,
  TURN_LOST: -10,
  BOARD_WON: 2000,
  BOARD_LOST: -2000,
  /** Per own coin near a pocket, scaled by closeness. */
  OWN_NEAR_POCKET: 12,
  /** Per opponent-usable coin near a pocket when the turn passes. */
  OPP_NEAR_POCKET: -8,
  /** "Near" = centre within this distance of a pocket centre. */
  NEAR_POCKET_DIST: 0.15,
} as const;

/** BOT-6: the client bot "thinks" at least this long, ms. */
export const BOT_MIN_THINK_MS = 600;
export const BOT_MAX_THINK_MS = 1200;
