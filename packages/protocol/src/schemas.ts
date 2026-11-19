import { config, type Seat, type ShotInput } from '@carrom/engine';
import type { GameState, RuleEvent } from '@carrom/rules';
import { z } from 'zod';
import type { ClientMessage, ServerMessage } from './messages';

/** A direction counts as a unit vector when its length is within this of 1. */
export const UNIT_TOLERANCE = 1e-6;
export const EMOTE_ID_MAX = 32;

const finite = z.number().finite();
const seat = z.number().int().min(0).max(3);
const emoteId = z.string().min(1).max(EMOTE_ID_MAX);

/**
 * Aim fields: finite numbers, x on the baseline, power in range, and a unit
 * direction no further from straight ahead than `minForward` allows
 * (dirY >= minForward, the cosine of the largest legal aim angle).
 */
function aimFields(minForward: number) {
  return z.object({
    x: finite.min(-config.BASELINE_HALF).max(config.BASELINE_HALF),
    dirX: finite,
    dirY: finite,
    power: finite.min(config.MIN_POWER).max(config.MAX_POWER),
  }).superRefine((v, ctx) => {
    const len = Math.sqrt(v.dirX * v.dirX + v.dirY * v.dirY);
    if (Math.abs(len - 1) > UNIT_TOLERANCE) {
      ctx.addIssue({ code: 'custom', message: 'Direction is not a unit vector', path: ['dirX'] });
    } else if (v.dirY < minForward) {
      ctx.addIssue({ code: 'custom', message: 'Aim is past the largest legal angle', path: ['dirY'] });
    }
  });
}

/** ShotInput schema for a given aim limit (cosine of the largest angle). */
export function makeShotInputSchema(minForward: number = config.MIN_AIM_FORWARD) {
  return z.object({ seat }).and(aimFields(minForward)).transform(
    (v): ShotInput => ({ seat: v.seat as Seat, x: v.x, dirX: v.dirX, dirY: v.dirY, power: v.power }),
  );
}

/** Uses the engine's aim limit (config.MIN_AIM_FORWARD). */
export const ShotInputSchema = makeShotInputSchema();

const aimMessage = aimFields(config.MIN_AIM_FORWARD);

export const ClientMessageSchema: z.ZodType<ClientMessage> = z.union([
  z.object({ type: z.literal('shot'), turnId: z.number().int().min(0), input: ShotInputSchema }),
  z.object({ type: z.literal('aim') }).and(aimMessage),
  z.object({ type: z.literal('emote'), id: emoteId }),
  z.object({ type: z.literal('rematch') }),
]);

const isObject = (v: unknown): boolean => typeof v === 'object' && v !== null;

/** Server messages come from our own server: the envelope is checked, game state is not. */
export const ServerMessageSchema: z.ZodType<ServerMessage> = z.union([
  z.object({
    type: z.literal('shotResult'),
    turnId: z.number().int().min(0),
    seat,
    input: ShotInputSchema,
    ruleEvents: z.array(z.custom<RuleEvent>(isObject)),
    stateHash: z.string(),
    state: z.custom<GameState>(isObject),
  }),
  z.object({ type: z.literal('aim'), seat }).and(aimMessage),
  z.object({ type: z.literal('error'), code: z.string(), message: z.string() }),
  z.object({ type: z.literal('emote'), seat, id: emoteId }),
]);

/** Parse an unknown payload; null when it is not a valid client message. */
export function parseClientMessage(data: unknown): ClientMessage | null {
  const r = ClientMessageSchema.safeParse(data);
  return r.success ? r.data : null;
}
