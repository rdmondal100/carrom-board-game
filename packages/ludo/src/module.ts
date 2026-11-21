import type { GameModule } from '@hub/game-kit';
import { z } from 'zod';
import { seatsOf, teamOf } from './board';
import { ludoBot } from './bot';
import { applyLudoMove, ludoResult, ludoTimeout, newLudo, nextSeatOf } from './rules';
import type { LudoConfig, LudoEvent, LudoMove, LudoState, LudoView } from './types';

/** LUDO-2 room settings; 2v2 needs four players. */
export const LudoConfigSchema: z.ZodType<LudoConfig> = z.object({
  preset: z.enum(['classic', 'bd']),
  players: z.union([z.literal(2), z.literal(3), z.literal(4)]),
  teams: z.boolean(),
  quick: z.boolean(),
  tapToRoll: z.boolean(),
}).refine((c) => !c.teams || c.players === 4, { message: '2v2 needs four players' });

export const LudoMoveSchema: z.ZodType<LudoMove> = z.union([
  z.object({ token: z.number().int().min(0).max(3) }).strict(),
  z.object({ roll: z.literal(true) }).strict(),
]);

/** LUDO-2 the default settings (and the ranked ones: 1v1, BD rules). */
export const DEFAULT_LUDO_CONFIG: LudoConfig = { preset: 'bd', players: 2, teams: false, quick: false, tapToRoll: false };

export function ludoView(s: LudoState): LudoView {
  const view: Partial<LudoState> = { ...s };
  delete view.rng;
  delete view.seed;
  return view as LudoView;
}

/** LUDO-1 Ludo on the hub's game contract. No hidden information, but the dice source stays on the server. */
export const ludoModule: GameModule<LudoConfig, LudoState, LudoMove, LudoEvent, LudoView> = {
  id: 'ludo',
  hasHiddenInfo: false,
  configSchema: LudoConfigSchema,
  moveSchema: LudoMoveSchema,
  seats: seatsOf,
  teamOf,
  configOf: (s) => s.config,
  newGame: (c, seed) => newLudo(c, seed),
  rematch: (s) => newLudo(s.config, (s.seed + 1) >>> 0, nextSeatOf(s.config, s.first)),
  applyMove: applyLudoMove,
  timeout: ludoTimeout,
  takeovers: (events) => events.flatMap((e) => (e.type === 'botTakeover' ? [e.seat] : [])),
  turnSeat: (s) => s.turnSeat,
  turnId: (s) => s.turnId,
  result: ludoResult,
  view: ludoView,
  hash: (s) => `${s.tokens.map((l) => l.join(',')).join('|')}:${s.turnSeat}:${s.turnId}:${s.phase}:${s.dice ?? 0}`,
  rounds: () => 1,
  bot: ludoBot,
};
