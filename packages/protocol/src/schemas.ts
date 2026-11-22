import { config, type Seat, type ShotInput } from '@carrom/engine';
import { z } from 'zod';
import { GroupPlayersSchema } from './adda';
import type { ClientMessage, ServerMessage } from './messages';
import { EMOTES } from './room';
import { SessionIdSchema, VoiceSignalSchema } from './voice';

/** A direction counts as a unit vector when its length is within this of 1. */
export const UNIT_TOLERANCE = 1e-6;

const finite = z.number().finite();
const seat = z.number().int().min(0).max(3);
/** ROOM-10: only the fixed emote ids. */
const emoteId = z.enum(EMOTES);
const turnId = z.number().int().min(0);
/** HUB-5 game payloads: the envelope only checks they are there; the game module checks the rest. */
const payload = z.custom<unknown>((v) => v !== undefined);

// ---- carrom payloads (used by the carrom game module and client) ----------

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

/** ROOM-6 carrom's live aim preview (the `hint` payload). */
export interface AimHint { x: number; dirX: number; dirY: number; power: number }
export const AimHintSchema: z.ZodType<AimHint> = aimFields(config.MIN_AIM_FORWARD);

// ---- the envelope ----------------------------------------------------------

export const ClientMessageSchema: z.ZodType<ClientMessage> = z.union([
  z.object({ type: z.literal('move'), turnId, move: payload }),
  z.object({ type: z.literal('hint'), data: payload }),
  z.object({ type: z.literal('emote'), id: emoteId }),
  z.object({ type: z.literal('rematch') }),
  z.object({ type: z.literal('start') }),
  z.object({ type: z.literal('swap'), a: seat, b: seat }),
  z.object({ type: z.literal('seatBot'), seat, on: z.boolean() }),
  z.object({ type: z.literal('voice'), to: SessionIdSchema, signal: VoiceSignalSchema }),
  z.object({ type: z.literal('voiceState'), on: z.boolean(), muted: z.boolean() }),
  z.object({ type: z.literal('nextGame'), gameId: z.string().min(1).max(32), players: GroupPlayersSchema }),
]);

const events = z.array(z.unknown());

/** Server messages come from our own server: the envelope is checked, game payloads are not. */
export const ServerMessageSchema: z.ZodType<ServerMessage> = z.union([
  z.object({
    type: z.literal('moveResult'),
    turnId,
    seat,
    move: payload,
    events,
    hash: z.string(),
    view: payload,
    durationMs: z.number().min(0),
  }),
  z.object({ type: z.literal('hint'), seat, data: payload }),
  z.object({ type: z.literal('error'), code: z.string(), message: z.string() }),
  z.object({ type: z.literal('emote'), seat, id: emoteId }),
  z.object({ type: z.literal('game'), view: payload, turnId }),
  z.object({ type: z.literal('timeout'), turnId, seat, events, view: payload }),
  z.object({ type: z.literal('clock'), turnId, ms: z.number().min(0) }),
  z.object({
    type: z.literal('rankedResult'),
    winner: z.string(),
    abandoned: z.boolean(),
    players: z.array(z.object({
      seat, userId: z.string(), ratingBefore: z.number().int(), ratingAfter: z.number().int(),
    })),
  }),
  z.object({ type: z.literal('reward'), coins: z.number().int().min(0) }),
  z.object({ type: z.literal('voice'), from: SessionIdSchema, signal: VoiceSignalSchema }),
  z.object({
    type: z.literal('nextRoom'), roomId: z.string().min(1).max(64), code: z.string().max(16), gameId: z.string().min(1).max(32),
  }),
]);

/** Parse an unknown payload; null when it is not a valid client message. */
export function parseClientMessage(data: unknown): ClientMessage | null {
  const r = ClientMessageSchema.safeParse(data);
  return r.success ? r.data : null;
}

/** Parse an unknown payload; null when it is not a valid server message. */
export function parseServerMessage(data: unknown): ServerMessage | null {
  const r = ServerMessageSchema.safeParse(data);
  return r.success ? r.data : null;
}
