import type { CarromRoomConfig } from '@carrom/protocol';
import { START_RATING } from '../models/user.model.js';

/** RANK-1: every ranked carrom game is 1v1, colour preset, one board. */
export const CARROM_RANKED: CarromRoomConfig = { format: '1v1', preset: 'colour', length: { kind: 'board' } };

/** HUB-6 the settings of each game's ranked play (games not listed have no ranked queue). */
export const RANKED_CONFIGS: Record<string, unknown> = { carrom: CARROM_RANKED };

/** RANK-1 Elo. */
export const ELO_START = START_RATING;
export const ELO_K = 32;
/** Rating gap that makes the stronger player 10× as likely to win. */
export const ELO_SCALE = 400;

/** RANK-2 pairing window: ±START at first, +STEP every STEP_MS, at most ±MAX. */
export const WINDOW_START = 100;
export const WINDOW_STEP = 50;
export const WINDOW_STEP_MS = 5000;
export const WINDOW_MAX = 400;

/** Waits in the ranked queue and room. Tests pass shorter ones. */
export interface RankedTiming {
  /** RANK-2 how often the queue looks for pairs (and tells players their window). */
  tickMs: number;
  /** RANK-3 offer "play vs bot" after this long unmatched. */
  botOfferMs: number;
  /** A matched pair must both join the ranked room within this, or the room closes. */
  joinWaitMs: number;
}

export const DEFAULT_RANKED_TIMING: RankedTiming = {
  tickMs: 1000,
  botOfferMs: 60_000,
  joinWaitMs: 20_000,
};

/** HUB-6 Redis keys of one game's queue. */
export const queueKey = (gameId: string): string => `ranked:${gameId}:queue`;
export const queueSinceKey = (gameId: string): string => `ranked:${gameId}:since`;

/** RANK-6 / history list sizes. */
export const LEADERBOARD_DEFAULT = 100;
export const LEADERBOARD_MAX = 100;
export const HISTORY_DEFAULT = 20;
export const HISTORY_MAX = 50;
