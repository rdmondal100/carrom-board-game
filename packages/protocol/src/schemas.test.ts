import { describe, expect, it } from 'vitest';
import {
  AimHintSchema, makeShotInputSchema, parseClientMessage, ServerMessageSchema, ShotInputSchema,
} from './schemas';

/** cos 85° and sin 85°, written out. */
const COS_85 = 0.08715574274765817;
const SIN_85 = 0.9961946980917455;
const schema85 = makeShotInputSchema(COS_85);
const valid = { seat: 0, x: 0.1, dirX: 0.6, dirY: 0.8, power: 0.7 };

describe('ShotInputSchema', () => {
  it('SRV-6 accepts a valid shot', () => {
    expect(schema85.safeParse(valid).success).toBe(true);
    expect(ShotInputSchema.parse(valid)).toEqual(valid);
  });

  it.each([
    ['NaN x', { ...valid, x: Number.NaN }],
    ['NaN power', { ...valid, power: Number.NaN }],
    ['NaN direction', { ...valid, dirX: Number.NaN }],
    ['Infinity x', { ...valid, x: Number.POSITIVE_INFINITY }],
    ['x past the baseline (right)', { ...valid, x: 0.5 }],
    ['x past the baseline (left)', { ...valid, x: -0.5 }],
    ['power above max', { ...valid, power: 1.01 }],
    ['power below min', { ...valid, power: 0.01 }],
    ['non-unit direction', { ...valid, dirY: 0.8 + 2e-6 }],
    ['zero direction', { ...valid, dirX: 0, dirY: 0 }],
    ['aim past 85°', { ...valid, dirX: 0.999, dirY: Math.sqrt(1 - 0.999 * 0.999) }],
    ['aim backwards', { ...valid, dirX: 0, dirY: -1 }],
    ['seat out of range', { ...valid, seat: 4 }],
    ['fractional seat', { ...valid, seat: 1.5 }],
    ['missing power', { seat: 0, x: 0, dirX: 0, dirY: 1 }],
  ])('SRV-6 rejects %s', (_name, input) => {
    expect(schema85.safeParse(input).success).toBe(false);
  });

  it('SRV-6 accepts aim exactly at 85° and a direction within 1e-6 of unit', () => {
    expect(schema85.safeParse({ ...valid, dirX: SIN_85, dirY: COS_85 }).success).toBe(true);
    expect(schema85.safeParse({ ...valid, dirY: 0.8 + 5e-7 }).success).toBe(true);
  });

  it('SRV-6 default schema follows the engine aim limit (any direction)', () => {
    expect(ShotInputSchema.safeParse({ ...valid, dirX: 0, dirY: -1 }).success).toBe(true);
    expect(ShotInputSchema.safeParse({ ...valid, dirX: 0, dirY: -1.1 }).success).toBe(false);
  });
});

describe('client messages', () => {
  it('SRV-6 parses each valid message type', () => {
    expect(parseClientMessage({ type: 'move', turnId: 3, move: valid })).not.toBeNull();
    expect(parseClientMessage({ type: 'hint', data: { x: 0, dirX: 0, dirY: 1, power: 0.5 } })).not.toBeNull();
    expect(parseClientMessage({ type: 'emote', id: 'wow' })).not.toBeNull();
    expect(parseClientMessage({ type: 'rematch' })).toEqual({ type: 'rematch' });
  });

  it('SRV-6 rejects bad messages', () => {
    expect(parseClientMessage({ type: 'move', turnId: -1, move: valid })).toBeNull();
    expect(parseClientMessage({ type: 'move', turnId: 1 })).toBeNull();
    expect(parseClientMessage({ type: 'hint' })).toBeNull();
    // HUB-5 the game payload is checked by the game module, not the envelope.
    expect(parseClientMessage({ type: 'move', turnId: 1, move: { ...valid, power: 2 } })).not.toBeNull();
    expect(parseClientMessage({ type: 'emote', id: '' })).toBeNull();
    expect(parseClientMessage({ type: 'emote', id: 'x'.repeat(33) })).toBeNull();
    expect(parseClientMessage({ type: 'nope' })).toBeNull();
    expect(parseClientMessage(null)).toBeNull();
  });

  it('ROOM-6 carrom aim hint: unit direction, legal power', () => {
    expect(AimHintSchema.safeParse({ x: 0, dirX: 0, dirY: 1, power: 0.5 }).success).toBe(true);
    expect(AimHintSchema.safeParse({ x: 0, dirX: 0, dirY: 2, power: 0.5 }).success).toBe(false);
  });

  it('SRV-6 server error message parses', () => {
    const msg = { type: 'error', code: 'BAD_SHOT', message: 'no' };
    expect(ServerMessageSchema.parse(msg)).toEqual(msg);
  });
});
