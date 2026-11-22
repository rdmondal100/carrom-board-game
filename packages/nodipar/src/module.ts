import { stateHash } from '@carrom/engine';
import type { GameModule } from '@hub/game-kit';
import { z } from 'zod';
import { nodiBot } from './bot';
import { seatsOf, teamOf } from './islands';
import { applyNodiMove, newNodi, nextSeatOf, nodiResult, nodiTimeout } from './rules';
import type { NodiConfig, NodiEvent, NodiMove, NodiState, NodiView } from './types';

/** NODI-2 room settings. */
export const NodiConfigSchema: z.ZodType<NodiConfig> = z.object({
  players: z.union([z.literal(2), z.literal(4)]),
  borsha: z.boolean(),
}).strict();

const aim = { dirX: z.number().finite(), dirY: z.number().finite(), power: z.number().finite() };

export const NodiMoveSchema: z.ZodType<NodiMove> = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('launch'), x: z.number().finite(), ...aim }).strict(),
  z.object({ kind: z.literal('flick'), boat: z.number().int().min(0).max(5), ...aim }).strict(),
]);

export const DEFAULT_NODI_CONFIG: NodiConfig = { players: 2, borsha: false };

/** NODI-2 Nodi Par on the hub's game contract. No hidden information and no dice. */
export const nodiParModule: GameModule<NodiConfig, NodiState, NodiMove, NodiEvent, NodiView> = {
  id: 'nodipar',
  hasHiddenInfo: false,
  configSchema: NodiConfigSchema,
  moveSchema: NodiMoveSchema,
  seats: seatsOf,
  teamOf,
  configOf: (s) => s.config,
  newGame: (c, seed) => newNodi(c, seed),
  rematch: (s) => newNodi(s.config, (s.seed + 1) >>> 0, nextSeatOf(s.config, s.first)),
  applyMove: applyNodiMove,
  timeout: nodiTimeout,
  takeovers: (events) => events.flatMap((e) => (e.type === 'botTakeover' ? [e.seat] : [])),
  turnSeat: (s) => s.turnSeat,
  turnId: (s) => s.turnId,
  result: nodiResult,
  view: (s) => s,
  hash: (s) => `${stateHash(s.board)}:${s.turnSeat}:${s.turnId}:${s.round}`,
  rounds: (s) => s.results.length,
  bot: nodiBot,
};
